// opencc-js ships types for its entry points but not for the per-dictionary
// modules (exported via its "./*" pattern). Each default-exports one
// serialized dictionary ("src dst|src dst|…"), which ConverterFactory accepts.
declare module 'opencc-js/dict/*' {
  const dict: string;
  export default dict;
}
