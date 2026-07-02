# 青雲(5386) 沉沒基金

幽默諷刺風格的**股票虧損視覺化儀表板**。把投資組合想像成一艘船，虧損越多，船沉得越深。

> 純娛樂性質的個人專案，不構成任何投資建議。

## 線上預覽

部署於 GitHub Pages（合併至 `main` 並啟用 Pages 後可於以下網址存取）：

```
https://<你的 GitHub 帳號>.github.io/<repo 名稱>/
```

## 功能

- **沉船主視覺**：SVG 船隻隨虧損百分比下沉，水面持續波浪動畫
- **氣泡效果**：虧損越大，氣泡越密集
- **即時數據面板**：累計虧損金額、虧損百分比、今日收盤價、殘餘本金比例
- **海底深度剖面圖**：以歷史資料繪製虧損走勢線
- **黑色幽默里程碑**：依虧損區間切換航海事故通報文案

## 資料來源與更新頻率

| 項目 | 說明 |
|------|------|
| 股票代號 | `5386.TWO`（青雲，台灣櫃買） |
| 資料來源 | Yahoo Finance（透過 `yfinance` 套件） |
| 自動更新 | 每個**交易日**台北時間 **15:30**（UTC 07:30） |
| 歷史資料 | 累積儲存於 `data/price-history.json` |

## 專案結構

```
├── index.html              # 前端主頁
├── css/style.css           # 樣式與動畫
├── js/app.js               # 資料讀取與圖表渲染
├── config.json             # 持股設定（均價、股數等）
├── data/price-history.json # 每日收盤歷史（由 workflow 自動更新）
├── scripts/fetch_price.py  # 股價抓取與計算腳本
├── requirements.txt        # Python 依賴
└── .github/workflows/
    └── update-stock.yml    # 每日自動更新 workflow
```

## 修改持股設定

編輯 `config.json`：

```json
{
  "ticker": "5386.TWO",
  "stock_name": "青雲",
  "buy_price": 540.22,
  "shares": 9000,
  "cost_basis": 4861980
}
```

## 手動觸發更新

### 方法一：GitHub Actions（推薦）

1. 前往 repo 的 **Actions** 分頁
2. 選擇 **Update Stock Price** workflow
3. 點擊 **Run workflow** → **Run workflow**

### 方法二：本機執行

```bash
pip install -r requirements.txt
python scripts/fetch_price.py
```

執行後會更新 `data/price-history.json`，手動 commit 並 push 即可。

## GitHub Pages 部署設定

1. 進入 repo **Settings** → **Pages**
2. **Source** 選擇 **Deploy from a branch**
3. **Branch** 選 `main`，資料夾選 `/ (root)`
4. 儲存後等待數分鐘，網站即可上線

本專案為純靜態 HTML/CSS/JS，**不需要 build step**。

## 授權

MIT — 隨意使用、修改、嘲笑自己的投資組合。
