import babel from 'rollup-plugin-babel';
import { minify } from 'uglify-es';
import uglify from 'rollup-plugin-uglify-es';
import { name } from './package.json';

const isProduction = process.env.NODE_ENV === 'production';
const destBase = 'dist/model-graph';
const destExtension = `${isProduction ? '.min' : ''}.js`;

export default [
  {
    input: 'src/index.js',
    external: ['normalizr'],
    output: [
      { file: `${destBase}${destExtension}`, format: 'cjs' },
      { file: `${destBase}.es${destExtension}`, format: 'es' },
      { file: `${destBase}.umd${destExtension}`, format: 'umd', name, globals: {normalizr: 'normalizr'} },
    ],
    plugins: [
      babel({runtimeHelpers: true}),
      isProduction && uglify({}, minify),
    ].filter(Boolean),
  },
];
