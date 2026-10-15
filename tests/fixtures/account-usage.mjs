import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
// Explicit synthetic authorization for tenant/browser tests. These tests isolate
// identity and sync behavior; actual atomic byte caps have a separate suite.
export function fixtureAccountUsage(allowedOwners){
 const allowed=new Set(allowedOwners),claims=new Map();
 const check=owner=>assert.ok(allowed.has(owner),'fixture owner requires explicit byte authorization: '+owner);
 return {async reserveStorage({owner}){check(owner);return {reservation_id:'synthetic-storage-'+randomUUID()};},async authorizeReservedStorage({owner}){check(owner);return {authorized:true};},async authorizePlanAsset({owner}){check(owner);return {authorized:true};},async beginTransfer({owner,byte_count}){check(owner);const claim_id=randomUUID();claims.set(claim_id,{owner,byte_count});return {claim_id};},async completeTransfer({owner,claim_id,actual_bytes}){check(owner);const claim=claims.get(claim_id);assert.equal(claim?.owner,owner);assert.ok(actual_bytes<=claim.byte_count);claims.delete(claim_id);},async holdTransfer({owner}){check(owner);}};
}
