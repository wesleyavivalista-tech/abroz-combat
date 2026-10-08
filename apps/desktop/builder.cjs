/* eslint-disable @typescript-eslint/no-require-imports -- Electron sandbox preload and builder config use CommonJS. */
/* global require, module */
const metadata=require('./metadata.json');
module.exports={
 appId:metadata.appId,productName:metadata.productName,executableName:metadata.executableName,
 extraMetadata:{main:'apps/desktop/main.mjs',description:metadata.description,...(metadata.publisher?{author:metadata.publisher}:{})},
 directories:{output:'release'},
 files:['apps/desktop/main.mjs','apps/desktop/preload.cjs','apps/desktop/policy.mjs','apps/desktop/metadata.json','package.json','!node_modules/**/*'],
 extraResources:[{from:'dist-desktop',to:'game'}],asar:true,npmRebuild:false,
 ...(metadata.icon?{icon:metadata.icon}:{}),
 win:{target:[{target:'nsis',arch:['x64']}]},
 nsis:{oneClick:false,allowToChangeInstallationDirectory:true,deleteAppDataOnUninstall:false},
 mac:{target:['dmg'],category:metadata.category,hardenedRuntime:true},
 linux:{target:['AppImage'],category:'Game'},
 artifactName:'${productName}-${version}-${os}-${arch}.${ext}',
};
