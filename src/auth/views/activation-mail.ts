const activationMailTemplate = (link: string) => {
  return `
        <div>
            <h1>To activate your account, follow the link</h1>
            <a href="${link}">${link}</a>
        </div>
    `;
};

export { activationMailTemplate };
