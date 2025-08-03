module.exports = {
  plugins: {
    tailwindcss: {},
    'postcss-rem-to-pixel': {
      rootValue: 16, // 1rem = 16px
      unitPrecision: 5,
      propList: ['*'],
      selectorBlackList: [],
      replace: true,
      mediaQuery: false,
      minRemValue: 0
    },
    autoprefixer: {},
  },
}