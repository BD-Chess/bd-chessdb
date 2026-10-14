import {runtimeService} from './lib/dualframe/runtime.mjs';
export default async req=>(await runtimeService()).handle(req);
export const config={rateLimit:{action:'rate_limit',aggregateBy:'ip',windowSize:60,windowLimit:12}};
