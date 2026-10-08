// pnpm forwards its separator; electron-builder treats it as the end of options.
export function desktopBuildArgs(args) {
 return args.filter(arg=>arg!=='--'&&arg!=='--offline');
}
