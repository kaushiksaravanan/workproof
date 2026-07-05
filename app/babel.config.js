module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    overrides: [
      {
        // ethers v6's CJS build ships ES private-class fields
        // (`#root: HDNodeWallet`). Metro's default pipeline skips heavy
        // transforms for node_modules, so Hermes on Expo Go SDK 54 hits
        // "SyntaxError: private properties are not supported" at first call.
        test: /node_modules[\\/]ethers[\\/]/,
        plugins: [['@babel/plugin-transform-class-properties', { loose: true }]],
      },
    ],
  };
};
