export interface CimcConfig {
  host: string;
  username: string;
  password: string;
  verifyTls: boolean;
  interface?: string;
}

export interface SessionState {
  cookie: string;
  expiresAt: number;
  refreshPeriod: number;
}

export interface CimcError {
  errorCode: string;
  errorDescr: string;
  invocationResult?: string;
}

export interface ServerSummary {
  dn: string;
  adminPower: string;
  operPower: string;
  availableMemory: string;
  numOfCores: string;
  numOfCpus: string;
  numOfThreads: string;
  totalMemory: string;
  serial: string;
  name: string;
  serverId: string;
  uuid: string;
  vendor: string;
  model: string;
  operability: string;
  presence: string;
  [key: string]: string;
}
