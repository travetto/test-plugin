export interface ApplicationArgument {
  name: string;
  type?: string;
  def?: string;
  meta?: any;
}

export interface Application {
  name: string;
  filename: string;
  arguments?: ApplicationArgument[];
  id: string;
  description?: string;
  watchable?: boolean;
  env: string;
}

export type AppChoice = Application & { args?: string[], time?: number, key?: string };