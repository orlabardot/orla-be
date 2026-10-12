import { defineRailway, github, project, service } from "railway/iac";
// This repository manages only its own resources in the environment. Other
// repositories export their own partial name.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = "orla-be";
export default defineRailway(() => {
  const orlaBe = service("orla-be", {
    source: github("orlabardot/orla-be", { branch: "main", checkSuites: false }),
    build: { builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    start: "node dist/server.js",
    healthcheck: "/health",
    healthcheckTimeout: 60,
    preDeploy: "node_modules/.bin/prisma migrate deploy",
    // O `railway config migrate` não traduz a restart policy do railway.toml.
    deploy: { restartPolicyType: "ON_FAILURE", restartPolicyMaxRetries: 3 },
    replicas: { "us-west2": 1 },
  });

  return project("orla bardot - be", {
    variables: { managed: false },
    resources: [orlaBe],
  });
});
