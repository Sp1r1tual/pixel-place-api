import axios from "axios";

class EmailService {
  private getMailServiceUrl(): string {
    const url = process.env.MAIL_SERVICE_URL;

    if (!url)
      throw new Error(
        "MAIL_SERVICE_URL is not defined in environment variables",
      );
    return url;
  }

  public async sendActivationMail(
    email: string,
    link: string,
    retries: number = 2,
  ): Promise<void> {
    const mailServiceUrl = this.getMailServiceUrl();
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await axios.post(
          `${mailServiceUrl}/activation`,
          { email, link },
          { timeout: 10000 },
        );

        return;
      } catch (error) {
        lastError = error as Error;
        console.error(
          `Failed to send activation email (attempt ${attempt}/${retries}):`,
          error,
        );

        if (attempt < retries) {
          const delay = attempt * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(
      `Failed to send activation email after ${retries} attempts: ${lastError?.message}`,
    );
  }

  public async sendResetPasswordMail(
    email: string,
    link: string,
    retries: number = 2,
  ): Promise<void> {
    const mailServiceUrl = this.getMailServiceUrl();
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await axios.post(
          `${mailServiceUrl}/reset`,
          { email, link },
          { timeout: 10000 },
        );

        return;
      } catch (error) {
        lastError = error as Error;
        console.error(
          `Failed to send reset email (attempt ${attempt}/${retries}):`,
          error,
        );

        if (attempt < retries) {
          const delay = attempt * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(
      `Failed to send reset password email after ${retries} attempts: ${lastError?.message}`,
    );
  }
}

export { EmailService };
