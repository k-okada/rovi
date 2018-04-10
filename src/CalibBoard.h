#pragma once

#include <opencv2/opencv.hpp>
#include "ParaConfigure.h"


class CalibBoard : public ParaConfigure {
public:
	CalibBoard() {
		para["do_qualize_hist"] = 0;// ヒストグラム均一化を行う(1), 行わない(0)
		para["do_smoothing"] = 1;	// スムージングを行う(1), 行わない(0)
		para["bin_type"] = 1;		// 二値化タイプ(0: 通常二値化, 1: 判別分析二値化, 2: 適応二値化)
		para["bin_param0"] = 0;		// 二値化閾値0(bin_type==0の場合閾値, bin_type==2の場合ブロックサイズ, その他の場合は使用しない)
		para["bin_param1"] = 0;		// 二値化閾値1(bin_type==2の場合平均値からのオフセット値, その他の場合は使われない)
	}

	virtual ~CalibBoard() {	}

protected:
	/**
	 * キャリブレーションボードから特徴点を抽出するための前処理を実行する
	 * @return 前処理後の画像
	 * @param source 処理対象の画像
	 */
	cv::Mat preprocess(cv::Mat &source) {
		// ノイズ除去
		if (para["do_smoothing"] != 0) {
			cv::Mat tmpim = source.clone();
			cv::medianBlur(tmpim, source, 3);
		}

		// ヒストグラム均一化
		if (para["do_equalize_hist"] != 0) {
			cv::Mat tmpim = source.clone();
			cv::equalizeHist(tmpim, source);
		}

		// 二値化
		return binarize(source);
	}


private:
	/**
	 * 与えられた画像を二値化します.
	 * @return 二値化された画像
	 */
	cv::Mat binarize(cv::Mat &image) {
		cv::Mat retim;
		int bin_type = (int)para["bin_type"];
		switch (bin_type) {
		case 0:	// 通常の二値化
			cv::threshold(image, retim, para["bin_param0"], 255.0, cv::THRESH_BINARY);
			break;
		case 1:	// 判別分析二値化
			cv::threshold(image, retim, 0, 255, cv::THRESH_OTSU);
			break;
		case 2:	// 適応二値化
			cv::adaptiveThreshold(image, retim, 255.0, cv::ADAPTIVE_THRESH_MEAN_C, cv::THRESH_BINARY, (int) para["bin_param0"], para["bin_param1"]);
			break;
		default:
			break;
		}
		return retim;
	}
};