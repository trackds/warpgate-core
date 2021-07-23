export interface WarpgateAddr {
  serviceName: string;
  peerId: string;
}

export interface HostAddr {
  /**
   * @default "TCP"
   */
  proto?: "UDP" | "TCP";
  host: string;
  port: number;
}

export type ForwardId = string;
export type ForwardRuleId = string;

export function isWarpgateAddr(p: unknown): p is WarpgateAddr {
  return (
    typeof (p as WarpgateAddr).peerId === "string" &&
    typeof (p as WarpgateAddr).serviceName === "string"
  );
}

export function isHostAddr(p: unknown): p is HostAddr {
  const v = p as HostAddr;
  return (
    typeof v.host === "string" &&
    typeof v.port === "number" &&
    (typeof v.proto === "undefined" || v.proto === "TCP" || v.proto === "UDP")
  );
}
