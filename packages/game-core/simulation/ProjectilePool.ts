import type {Projectile} from '../types.js';
export function initializeProjectile(slot:Projectile,value:Projectile):void{
 for(const key of Object.keys(slot))if(!Object.hasOwn(value,key))Reflect.deleteProperty(slot,key);
 Object.assign(slot,value);
}
