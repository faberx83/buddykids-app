import { headers } from "next/headers";
import LoginForm from "./LoginForm";
import { tenantForHost, TENANT_CONFIG } from "@/lib/tenant";

export default async function LoginPage() {
  const headerList = await headers();
  const host = headerList.get("host") || "";
  const tenant = tenantForHost(host);
  const config = TENANT_CONFIG[tenant];
  const appName = config.title.split(" — ")[0];

  return <LoginForm tenant={tenant} appName={appName} themeColor={config.themeColor} />;
}
