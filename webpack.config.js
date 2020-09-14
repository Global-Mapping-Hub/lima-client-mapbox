//webpack.config.js
module.exports = {
	entry: './app/main.js',
	output: {
		filename: 'bundle.js'
	},
	node: {
		fs: "empty"
	},
	module: {
		rules: [
			{
				loader: 'babel-loader',
				test: /\.js$/,
				exclude: /node_modules/,
				options: {
					presets: [
						"@babel/preset-env"
					],
					plugins: [
						"@babel/plugin-proposal-class-properties"
					]
				}
			}
		]
	},
	devServer: {
		port: 8080
	}
};