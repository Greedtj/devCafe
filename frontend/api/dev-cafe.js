import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { handleDevCafeApi } = require("../../api/_dev-cafe-handler.cjs");

export default handleDevCafeApi;
