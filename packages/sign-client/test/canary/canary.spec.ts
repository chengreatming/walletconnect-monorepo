import { getSdkError } from "@walletconnect/utils";
import {
  initTwoClients,
  testConnectMethod,
  deleteClients,
  uploadToCloudWatch,
  TEST_EMIT_PARAMS,
} from "../shared";
import { describe, it, expect, afterEach } from "vitest";

const environment = process.env.ENVIRONMENT || "dev";

const log = (log: string) => {
  // eslint-disable-next-line no-console
  console.log(log);
};

describe("Canary", () => {
  describe("HappyPath", () => {
    it("connects", async () => {
      const clients = await initTwoClients();
      log("Clients initialized");
      const { sessionA } = await testConnectMethod(clients);
      log("Clients connected");

      await Promise.all([
        new Promise<void>((resolve, reject) => {
          const eventPayload: any = {
            topic: sessionA.topic,
            ...TEST_EMIT_PARAMS,
          };

          try {
            clients.B.on("session_delete", (event: any) => {
              expect(eventPayload.topic).to.eql(event.topic);
              resolve();
            });
          } catch (e) {
            reject();
          }
        }),
        new Promise<void>((resolve) => {
          clients.A.disconnect({
            topic: sessionA.topic,
            reason: getSdkError("USER_DISCONNECTED"),
          });
          resolve();
        }),
      ]);
      log("Clients disconnected");

      deleteClients(clients);
      log("Clients deleted");
    });
  });
  afterEach(async (done) => {
    const { suite, name, result } = done.meta;
    const metric_prefix = `${suite.name}.${name}`;
    const nowTimestamp = Date.now();
    await uploadToCloudWatch(
      environment,
      metric_prefix,
      result?.state === "pass",
      nowTimestamp - (result?.startTime || nowTimestamp),
    );
  });
});
