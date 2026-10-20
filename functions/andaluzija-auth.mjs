import {makeTripAuth} from './lib/andaluzija-access.mjs';
export default makeTripAuth();
export const config={rateLimit:{windowLimit:8,windowSize:60,aggregateBy:['ip','domain']}};
