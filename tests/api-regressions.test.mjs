import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fixture, until } from "./helpers/fixture.mjs";

test("隔离 API 回归：并发、恢复、权限与错误处理", { timeout: 90000 }, async t => {
  const f = await fixture(`api-${Date.now()}`);
  try {
    const login = await f.login();
    const cookie = login.cookie;
    const userId = login.body.user.id;
    const query = id => f.request(`/api/generate/${id}`, { cookie });
    const generate = body => f.request("/api/generate", { cookie, method: "POST", body });
    const completed = async id => {
      let result;
      await until(async () => {
        result = await query(id);
        return result.body.status === "succeeded" || result.body.status === "failed";
      });
      return result;
    };
    let succeededId;

    await t.test("8 张并行图片全部归档，期间账户更新不丢失", async () => {
      f.hold();
      const jobs = await Promise.all(Array.from({ length: 8 }, (_, i) => generate({
        prompt: `parallel-${i}`, model: i % 2 ? "gpt-image-2.5-sunburst" : "gpt-image-2.5-flare"
      })));
      await until(() => f.pending.length === 8);
      await f.request(`/api/admin/users/${userId}/credits`, { admin: true, method: "POST", body: { delta: 2 } });
      f.release();
      const results = await Promise.all(jobs.map(job => completed(job.body.requestId)));
      assert(results.every(result => result.body.status === "succeeded"));
      const data = f.data();
      assert.equal(data.generationHistory.filter(record => record.assets.generated.length === 1).length, 8);
      assert.equal(data.generationHistory.filter(record => record.status === "succeeded").length, 8);
      assert.equal(data.users[0].credits, 6.6);
      assert.equal(data.usageLogs.filter(log => log.status === "succeeded").length, 8);
      results.forEach((result, i) => assert.equal(result.body.model, i % 2 ? "gpt-image-2.5-sunburst" : "gpt-image-2.5-flare"));
      succeededId = jobs[0].body.requestId;
    });

    await t.test("供应商测试成功和失败均不覆盖期间的充值", async () => {
      for (const status of [200, 500]) {
        f.setResponseStatus(status);
        f.hold();
        const pending = f.request("/api/admin/providers/review/test", { admin: true, method: "POST" });
        await until(() => f.pending.length === 1);
        const adjusted = await f.request(`/api/admin/users/${userId}/credits`, { admin: true, method: "POST", body: { delta: 3 } });
        f.release();
        await pending;
        assert.equal(f.data().users.find(user => user.id === userId).credits, adjusted.body.user.credits);
      }
      f.setResponseStatus(200);
    });

    await t.test("查询结果需要登录和归属，响应不包含供应商地址", async () => {
      assert.equal((await f.request(`/api/generate/${succeededId}`)).status, 401);
      const other = await f.login("other@example.invalid");
      assert.equal((await f.request(`/api/generate/${succeededId}`, { cookie: other.cookie })).status, 404);
      const own = await query(succeededId);
      assert.equal(own.status, 200);
      assert(own.body.imageBase64);
      assert.equal(own.body.provider, undefined);
      assert.equal(own.body.userId, undefined);
      const balance = f.data().users.find(user => user.id === userId).credits;
      assert.equal((await generate({ prompt: "switched-account", clientUserId: other.body.user.id })).status, 403);
      assert.equal(f.data().users.find(user => user.id === userId).credits, balance);
    });

    await t.test("相同客户端图片 ID 的并发重试只调用一次上游、扣费一次", async () => {
      const before = f.data().users.find(user => user.id === userId).credits;
      f.hold();
      const body = { prompt: "retry", clientTaskId: "task-retry", clientImageId: "image-retry" };
      const jobs = await Promise.all([generate(body), generate(body)]);
      assert.equal(jobs[0].body.requestId, jobs[1].body.requestId);
      await until(() => f.pending.length === 1);
      assert.equal(f.data().generationHistory.filter(record => record.clientImageId === body.clientImageId).length, 1);
      f.release();
      await completed(jobs[0].body.requestId);
      assert.equal((await generate(body)).body.status, "succeeded");
      assert.equal(f.data().users.find(user => user.id === userId).credits, Math.round((before - 0.05) * 100) / 100);
    });

    await t.test("重启后中断任务退款且重复启动不重复退款，成功图片仍可下载", async () => {
      const before = f.data().users.find(user => user.id === userId).credits;
      f.hold();
      const job = await generate({ prompt: "restart", clientTaskId: "restart-task", clientImageId: "restart-image" });
      await until(() => f.pending.length === 1);
      await f.stop();
      f.release();
      await f.start();
      const failed = await query(job.body.requestId);
      assert.equal(failed.body.status, "failed");
      assert.match(failed.body.error, /返还/);
      assert.equal(f.data().users.find(user => user.id === userId).credits, before);
      assert.equal(f.data().usageLogs.find(log => log.requestId === job.body.requestId).status, "refunded");
      const success = await query(succeededId);
      assert.equal(success.body.status, "succeeded");
      assert.deepEqual(Buffer.from(success.body.imageBase64, "base64"), f.png);
      await f.stop();
      await f.start();
      assert.equal(f.data().users.find(user => user.id === userId).credits, before);
      assert.equal((await f.request(`/api/generate/${succeededId}`)).status, 401);
    });

    await t.test("已落盘图片但尚未结算的任务在重启后完成结算", async () => {
      await f.stop();
      const file = resolve(f.dir, "image2-data.json");
      const data = JSON.parse(readFileSync(file, "utf8"));
      const record = data.generationHistory.find(item => item.requestId === succeededId);
      record.status = "running";
      data.usageLogs.find(item => item.requestId === succeededId).status = "reserved";
      writeFileSync(file, JSON.stringify(data));
      const before = data.users.find(user => user.id === userId).credits;
      await f.start();
      assert.equal((await query(succeededId)).body.status, "succeeded");
      assert.equal(f.data().users.find(user => user.id === userId).credits, before);
      assert.equal(f.data().usageLogs.find(item => item.requestId === succeededId).status, "succeeded");
    });

    await t.test("畸形 JSON、非对象请求和目录访问返回受控错误，服务保持健康", async () => {
      for (const path of ["/api/auth/request-code", "/api/admin/login", "/api/redeem", "/api/generate"]) {
        for (const body of ["{", "null", "[]"]) {
          const response = await fetch(f.api + path, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body });
          assert.equal(response.status, 400, `${path} ${body}`);
        }
      }
      assert.equal((await fetch(f.api + "/assets")).status, 404);
      assert.equal((await fetch(f.api + "/%E0%A4%A")).status, 400);
      assert.equal((await f.request("/api/auth/me", { cookie })).status, 200);
      assert.equal(f.proc.exitCode, null);
    });

    await t.test("模型校验、生成失败退款及礼品卡单次兑换", async () => {
      const before = f.data().users.find(user => user.id === userId).credits;
      assert.equal((await generate({ prompt: "invalid", model: "invalid" })).status, 400);
      assert.equal(f.data().users.find(user => user.id === userId).credits, before);
      const failed = await generate({ prompt: "invalid-reference", mode: "edit", referenceImages: [{ dataUrl: "invalid" }] });
      assert.equal((await completed(failed.body.requestId)).body.status, "failed");
      assert.equal(f.data().users.find(user => user.id === userId).credits, before);
      const cards = await f.request("/api/admin/gift-cards", { admin: true, method: "POST", body: { credits: 1, count: 1 } });
      const redeem = () => f.request("/api/redeem", { cookie, method: "POST", body: { key: cards.body.giftCards[0].key } });
      const results = await Promise.all([redeem(), redeem()]);
      assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
    });

    await t.test("后台生成和失败记账都遇到写盘错误时，进程仍存活且重启可退款", async () => {
      const before = f.data().users.find(user => user.id === userId).credits;
      f.hold();
      const job = await generate({ prompt: "storage-failure" });
      await until(() => f.pending.length === 1);
      const blockedPath = resolve(f.dir, "image2-data.json.tmp");
      // 仅在隔离临时目录中制造不可写目标，不改变真实数据文件。
      mkdirSync(blockedPath);
      try {
        f.release();
        await until(() => f.logs.includes("[generation] persistence failed"));
        assert.equal(f.proc.exitCode, null);
      } finally {
        rmdirSync(blockedPath);
      }
      assert.equal((await query(job.body.requestId)).body.status, "failed");
      assert.equal((await f.request("/api/auth/me", { cookie })).status, 200);
      await f.stop();
      await f.start();
      assert.equal(f.data().users.find(user => user.id === userId).credits, before);
      assert.equal(f.data().usageLogs.find(log => log.requestId === job.body.requestId).status, "refunded");
    });
  } finally {
    await f.close();
  }
});
