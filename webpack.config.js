const path = require("path");
const TerserPlugin = require("terser-webpack-plugin");
const glob = require("glob");

const entries = glob.sync("./src/*.ts").reduce((acc, file) => {
  const name = path.basename(file, ".ts");
  acc[name] = path.resolve(__dirname, file);
  return acc;
}, {});

module.exports = {
  mode: "production",
  entry: entries,
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: true,
          },
          mangle: true,
          output: {
            comments: false,
          },
        },
      }),
    ],
  },
};
