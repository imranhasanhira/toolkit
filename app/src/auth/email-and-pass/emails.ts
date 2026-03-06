import {
  type GetPasswordResetEmailContentFn,
  type GetVerificationEmailContentFn,
} from "wasp/server/auth";

export const getVerificationEmailContent: GetVerificationEmailContentFn = ({
  verificationLink,
}) => {
  console.log("[Email] Verification link:", verificationLink);
  return {
    subject: "Verify your email",
    text: `Click the link below to verify your email: ${verificationLink}`,
    html: `
        <p>Click the link below to verify your email</p>
        <a href="${verificationLink}">Verify email</a>
    `,
  };
};

export const getPasswordResetEmailContent: GetPasswordResetEmailContentFn = ({
  passwordResetLink,
}) => {
  console.log("[Email] Password reset link:", passwordResetLink);
  return {
    subject: "Password reset",
    text: `Click the link below to reset your password: ${passwordResetLink}`,
    html: `
        <p>Click the link below to reset your password</p>
        <a href="${passwordResetLink}">Reset password</a>
    `,
  };
};
