import { PrismaClient } from "@prisma/client";
import { User } from "wasp/entities";
import type { MiddlewareConfigFn } from "wasp/server";
import type { PaymentPlan } from "./plans";

export interface CreateCheckoutSessionArgs {
  userId: User["id"];
  userEmail: NonNullable<User["email"]>;
  paymentPlan: PaymentPlan;
  prismaUserDelegate: PrismaClient["user"];
}

export interface FetchCustomerPortalUrlArgs {
  userId: User["id"];
  prismaUserDelegate: PrismaClient["user"];
}

export interface PaymentProcessor {
  id: "stripe" | "lemonsqueezy" | "polar";
  createCheckoutSession: (
    args: CreateCheckoutSessionArgs,
  ) => Promise<{ session: { id: string; url: string } }>;
  fetchCustomerPortalUrl: (
    args: FetchCustomerPortalUrlArgs,
  ) => Promise<string | null>;
  webhook: any; // Stubbbed
  webhookMiddlewareConfigFn: MiddlewareConfigFn;
}

/**
 * Choose which payment processor you'd like to use, then delete the
 * other payment processor code that you're not using  from `/src/payment`
 */
// export const paymentProcessor: PaymentProcessor = stripePaymentProcessor;
// export const paymentProcessor: PaymentProcessor = lemonSqueezyPaymentProcessor;
// export const paymentProcessor: PaymentProcessor = polarPaymentProcessor;

export const paymentProcessor: PaymentProcessor = {
  id: "stripe",
  createCheckoutSession: async () => {
    throw new Error("Payments are disabled.");
  },
  fetchCustomerPortalUrl: async () => {
    return null;
  },
  webhook: async (req: any, res: any, context: any) => {
    res.status(200).send("Payments disabled");
  },
  webhookMiddlewareConfigFn: (config: any) => config,
};
