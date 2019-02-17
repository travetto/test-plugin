export interface ParamConfig {
  name: string;
  title?: string;
  type?: string;
  subtype?: string;
  def?: string | boolean | number;
  optional?: boolean;
  meta?: any;
}