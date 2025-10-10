import nodemailer, { Transporter } from "nodemailer";

import { activationMailTemplate } from "../views/activation-mail.js";

class MailService {
  private transporter: Transporter | null;

  constructor() {
    this.transporter = null;
  }

  private initializeTransporter(): void {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.SMTP_USER as string,
          pass: process.env.SMTP_PASSWORD as string,
        },
      });
    }
  }

  public async sendActivationMail(to: string, link: string): Promise<void> {
    this.initializeTransporter();

    if (!this.transporter) {
      throw new Error("Transporter not initialized");
    }

    const info = await this.transporter.sendMail({
      from: process.env.SMTP_USER,
      to,
      subject: `Activating an account in ${process.env.API_URL}`,
      html: activationMailTemplate(link),
    });

    console.log("Email sent successfully:", info.messageId);
  }
}

export const mailService = new MailService();
