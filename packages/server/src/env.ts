export type NodeEnv = 'development' | 'production' | 'test';

export const nodeEnv: NodeEnv = (process.env.NODE_ENV as NodeEnv) || 'development';

export const isDev = nodeEnv === 'development';
export const isProd = nodeEnv === 'production';
export const isTest = nodeEnv === 'test';
