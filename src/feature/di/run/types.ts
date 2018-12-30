export interface ApplicationParam {
  name: string;
  type?: string;
  subtype?: string;
  def?: string;
  meta?: any;
}

export interface Application {
  name: string;
  filename: string;
  params?: ApplicationParam[];
  id: string;
  description?: string;
  watchable?: boolean;
  env: string;
}

export type AppChoice = Application & { inputs?: string[], time?: number, key?: string };