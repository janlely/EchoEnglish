const brevo = require("@getbrevo/brevo");  // 或 import * as brevo from "@getbrevo/brevo";
require('dotenv').config();  // 需要先 npm install dotenv

const apiInstance = new brevo.TransactionalEmailsApi();

const apiKey = process.env.BREVO_API_KEY;  // .env 文件中写：BREVO_API_KEY=xkeysib-xxxxxxxxxxxxxxxxxxxxx

apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, apiKey);
// 文件名：send-email.js

// 强烈建议使用环境变量存储 API Key，不要硬编码！


if (!apiKey) {
  console.error("请在 .env 文件中设置 BREVO_API_KEY");
  process.exit(1);
}

async function sendEmail() {
  const sendSmtpEmail = new brevo.SendSmtpEmail();

  sendSmtpEmail.subject = "First email from Brevo";
  sendSmtpEmail.textContent = "Hello world!\nThis is a test email.";
  // sendSmtpEmail.htmlContent = "<html><body><h1>Hello world!</h1></body></html>";  // 可选：用 HTML 格式

  sendSmtpEmail.sender = {
    name: "EchoEnglish",
    email: "Eric.Janlely@gmail.com"  // 必须是你已在 Brevo 验证过的发件人域名/邮箱
  };

  sendSmtpEmail.to = [
    { email: "98705766@qq.com", name: "Jay" }
  ];

  // 可选：添加回复地址、CC、附件等
  // sendSmtpEmail.replyTo = { email: "support@yourdomain.com" };

  try {
    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log("邮件发送成功！");
    console.log("Message ID:", data.body.messageId);
    console.log("完整响应:", JSON.stringify(data.body, null, 2));
  } catch (error) {
    console.error("发送邮件失败:");
    console.error(error.body || error.message);
    if (error.body) {
      console.error("错误详情:", JSON.stringify(error.body, null, 2));
    }
  }
}

sendEmail();
