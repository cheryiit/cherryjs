import { defineApp } from "convex/server";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import actionRetrier from "@convex-dev/action-retrier/convex.config";
import workflow from "@convex-dev/workflow/convex.config";
import aggregate from "@convex-dev/aggregate/convex.config";
import betterAuth from "@convex-dev/better-auth/convex.config";
import resend from "@convex-dev/resend/convex.config";
import polar from "@convex-dev/polar/convex.config";
import r2 from "@convex-dev/r2/convex.config";

const app = defineApp();
app.use(betterAuth);
app.use(resend);
app.use(rateLimiter);
app.use(actionRetrier);
app.use(workflow);
app.use(aggregate);
app.use(polar);
app.use(r2);

export default app;
