import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";

export default {
  input: "src/litAction.js",
  output: {
    file: "dist/bundle.js",
    format: "esm", // 'cjs' for CommonJS, 'esm' for ES modules
  },
  plugins: [
    resolve(), // Helps find node modules
    commonjs(), // Convert CommonJS modules to ES6, so they can be included in a Rollup bundle
    json(),
  ],
};
