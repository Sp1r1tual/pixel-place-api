import axios from "axios";

const MAX_ATTEMPTS = 2;
const REQUEST_TIMEOUT_MS = 10000;

class EmailService {
  private async post(path: string, email: string, link: string): Promise<void> {
    let lastMessage = "";

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        await axios.post(
          `${process.env.MAIL_SERVICE_URL}${path}`,
          { email, link },
          {
            timeout: REQUEST_TIMEOUT_MS,
            headers: { "x-mail-secret": process.env.MAIL_API_SECRET },
          },
        );

        return;
      } catch (error) {
        // Only the message: the full axios error contains the secret header.
        lastMessage = error instanceof Error ? error.message : String(error);
        console.error(
          `Mail request ${path} failed (attempt ${attempt}/${MAX_ATTEMPTS}): ${lastMessage}`,
        );

        if (attempt < MAX_ATTEMPTS) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
        }
      }
    }

    throw new Error(`Mail request ${path} failed: ${lastMessage}`);
  }

  public sendActivationMail(email: string, link: string): Promise<void> {
    return this.post("/activation", email, link);
  }

  public sendResetPasswordMail(email: string, link: string): Promise<void> {
    return this.post("/reset", email, link);
  }
}

export { EmailService };
