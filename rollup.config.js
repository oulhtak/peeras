const path = require("path");

module.exports = {
  input: "src/index.js",
  output: [
    {
      file: path.resolve(__dirname, "example/lib/peeras_bundle.js"),
      format: "es",
    },
  ],
};
