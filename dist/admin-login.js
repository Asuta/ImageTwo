const form = document.querySelector("#adminLoginForm");
const keyInput = document.querySelector("#adminLoginKey");
const toast = document.querySelector("#adminLoginToast");

function showToast(message) {
  toast.textContent = message;
  toast.classList.remove("hidden");
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  const key = keyInput.value.trim();
  if (!key) {
    showToast("请输入管理 Key");
    keyInput.focus();
    return;
  }

  try {
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key })
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.detail || payload.error || "登录失败");
    }

    window.location.assign("/admin");
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error));
  }
});
