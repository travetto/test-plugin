export interface ApplicationParam {
  name: string;
  title?: string;
  type?: string;
  subtype?: string;
  def?: string;
  meta?: any;
}

export interface Application {
  name: string;
  filename: string;
  params: ApplicationParam[];
  id: string;
  appRoot: string;
  description?: string;
  watchable?: boolean;
  env: string;
}

export type AppChoice = Application & {
  inputs: string[],
  time?: number,
  key?: string
};