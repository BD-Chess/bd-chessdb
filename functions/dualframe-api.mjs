import {getStore} from '@netlify/blobs';
import {createService} from './lib/dualframe/service.mjs';
const env=key=>Netlify.env.get(key);
export default async req=>createService({store:getStore({name:'dualframe-rd-v3',consistency:'strong'}),env}).handle(req);
export const config={rateLimit:{action:'rate_limit',aggregateBy:'ip',windowSize:60,windowLimit:400}};
