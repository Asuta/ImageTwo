process.env.PORT ||= "5180";
process.env.HOST ||= "127.0.0.1";
process.env.IMAGE2_SHOW_DEV_CODES ||= "true";
process.env.IMAGE2_MAIL_PROVIDER = "dev";
process.env.SENDCLOUD_API_USER = "dev-disabled";
process.env.SENDCLOUD_API_KEY = "dev-disabled";
process.env.MAIL_FROM = "dev-disabled";

await import("../server.js");
