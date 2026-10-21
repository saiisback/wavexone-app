import { colors, type Palette } from '../../design-system/colors'
import { tradingViewLicense, tradingViewRuntime } from './tradingview-runtime.generated'

/** The same self-contained chart document runs on iOS, Android and web. */
export const createTradingViewHtml = (colors: Palette) => `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'">
<style>
*{box-sizing:border-box}html,body{margin:0;height:100%;overflow:hidden;background:${colors.surface};font:12px -apple-system,BlinkMacSystemFont,Arial,sans-serif;color:${colors.brand}}
body{display:flex;flex-direction:column}.toolbar{display:flex;align-items:center;gap:6px;padding:8px;border-bottom:1px solid ${colors.divider};min-height:44px}
.symbol{font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}button{border:0;border-radius:8px;padding:7px 9px;background:${colors.well};color:${colors.brand};font:inherit;cursor:pointer;min-height:30px}button.active{background:${colors.gold};color:${colors.homePanel}}button:disabled{opacity:.4;cursor:default}button:focus-visible{outline:2px solid ${colors.brand}}
#plot{flex:1;min-height:0;position:relative}.readout{position:absolute;top:9px;left:10px;z-index:2;pointer-events:none;font-variant-numeric:tabular-nums;font-size:11px;color:${colors.textMuted};background:${colors.surface};padding:3px 5px;border-radius:4px}
footer{padding:5px 9px;font-size:9px;color:${colors.textMuted};border-top:1px solid ${colors.divider}}a{color:${colors.brand};text-decoration:none}
</style></head><body>
<div class="toolbar"><span class="symbol" id="symbol"></span><button id="candles" type="button" class="active" aria-pressed="true">Candles</button><button id="line" type="button" aria-pressed="false">Line</button><button id="reset" type="button" aria-label="Reset chart zoom">Reset</button></div>
<div id="plot"><div id="readout" class="readout"></div></div>
<footer><a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer">TradingView Lightweight Charts™ · © 2025 TradingView, Inc.</a></footer>
<script type="text/plain" id="tradingview-license">${tradingViewLicense.replace(/<\//g, '<\\/')}</script>
<script>${tradingViewRuntime.replace(/<\//g, '<\\/')}</script>
<script>
(function(){
  function notify(message){
    if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(message));
    else window.parent.postMessage(Object.assign({source:'wavex-tradingview'},message),'*');
  }
  try{
    var api=window.LightweightCharts,plot=document.getElementById('plot');
    var chart=api.createChart(plot,{
      layout:{background:{type:'solid',color:'${colors.surface}'},textColor:'${colors.textMuted}',fontSize:11,attributionLogo:true},
      grid:{vertLines:{color:'${colors.divider}'},horzLines:{color:'${colors.divider}'}},
      crosshair:{mode:api.CrosshairMode.Normal},
      rightPriceScale:{borderColor:'${colors.divider}',scaleMargins:{top:.15,bottom:.1}},
      timeScale:{borderColor:'${colors.divider}',timeVisible:true,secondsVisible:false,rightOffset:4},
      handleScroll:{mouseWheel:true,pressedMouseMove:true,horzTouchDrag:true,vertTouchDrag:false},
      handleScale:{mouseWheel:true,pinch:true,axisPressedMouseMove:true}
    });
    var candles=chart.addSeries(api.CandlestickSeries,{upColor:'${colors.green}',downColor:'${colors.red}',wickUpColor:'${colors.green}',wickDownColor:'${colors.red}',borderVisible:false});
    var line=chart.addSeries(api.LineSeries,{color:'${colors.brand}',lineWidth:2,visible:false});
    var previous=null,mode='candles',canCandle=false;
    var readout=document.getElementById('readout');
    function price(value){return Number(value).toFixed(previous?previous.precision:2)}
    function describe(bar){
      readout.textContent=!bar?'':bar.open===undefined?price(bar.value):'O '+price(bar.open)+'  H '+price(bar.high)+'  L '+price(bar.low)+'  C '+price(bar.close);
    }
    function selectMode(value){
      mode=value==='candles'&&canCandle?'candles':'line';
      candles.applyOptions({visible:mode==='candles'});line.applyOptions({visible:mode==='line'});
      ['candles','line'].forEach(function(id){var active=id===mode;document.getElementById(id).classList.toggle('active',active);document.getElementById(id).setAttribute('aria-pressed',String(active))});
      if(previous&&previous.theme)paintButtons(previous.theme);
      if(previous)describe(mode==='candles'?previous.candles[previous.candles.length-1]:previous.line[previous.line.length-1]);
    }
    function sameHistory(a,b){
      if(!a||a.length!==b.length)return false;
      for(var i=0;i<b.length-1;i++)if(JSON.stringify(a[i])!==JSON.stringify(b[i]))return false;
      return !b.length||a[a.length-1].time===b[b.length-1].time;
    }
    function setSeries(series,oldData,newData,reset){
      if(!reset&&sameHistory(oldData,newData)&&newData.length)series.update(newData[newData.length-1]);
      else series.setData(newData);
    }
    function paintButtons(theme){
      document.querySelectorAll('button').forEach(function(button){var active=button.classList.contains('active');button.style.color=active?theme.homePanel:theme.text;button.style.background=active?theme.gold:theme.well});
    }
    function setTheme(theme){
      if(!theme)return;
      document.documentElement.style.background=theme.surface;
      document.body.style.background=theme.surface;document.body.style.color=theme.text;
      document.querySelector('.toolbar').style.borderColor=theme.divider;
      readout.style.color=theme.textMuted;readout.style.background=theme.surface;
      document.querySelector('footer').style.color=theme.textMuted;document.querySelector('footer').style.borderColor=theme.divider;
      document.querySelector('footer a').style.color=theme.brand;
      paintButtons(theme);
      chart.applyOptions({layout:{background:{type:'solid',color:theme.surface},textColor:theme.textMuted},grid:{vertLines:{color:theme.divider},horzLines:{color:theme.divider}},rightPriceScale:{borderColor:theme.divider},timeScale:{borderColor:theme.divider}});
      candles.applyOptions({upColor:theme.green,downColor:theme.red,wickUpColor:theme.green,wickDownColor:theme.red});line.applyOptions({color:theme.brand});
    }
    window.wavexChart={setData:function(data){
      try{
        var reset=!previous||previous.key!==data.key;
        var format={type:'price',precision:data.precision,minMove:Math.pow(10,-data.precision)};
        candles.applyOptions({priceFormat:format});line.applyOptions({priceFormat:format});
        chart.applyOptions({timeScale:{timeVisible:data.intraday}});
        setSeries(candles,previous&&previous.candles,data.candles,reset);
        setSeries(line,previous&&previous.line,data.line,reset);
        canCandle=data.candles.length>0;document.getElementById('candles').disabled=!canCandle;
        document.getElementById('symbol').textContent=data.symbol;
        previous=data;selectMode(reset?(canCandle?'candles':'line'):mode);
        setTheme(data.theme);
        if(reset)chart.timeScale().fitContent();
      }catch(error){notify({type:'error'})}
    }};
    chart.subscribeCrosshairMove(function(event){
      var bar=event.seriesData.get(mode==='candles'?candles:line);
      if(!bar&&previous)bar=mode==='candles'?previous.candles[previous.candles.length-1]:previous.line[previous.line.length-1];
      describe(bar);
    });
    document.getElementById('candles').onclick=function(){selectMode('candles')};
    document.getElementById('line').onclick=function(){selectMode('line')};
    document.getElementById('reset').onclick=function(){chart.timeScale().fitContent()};
    document.querySelector('footer a').onclick=function(event){if(window.ReactNativeWebView){event.preventDefault();notify({type:'link'})}};
    var sized=false;
    function resize(){
      if(!plot.clientWidth||!plot.clientHeight)return;
      chart.resize(plot.clientWidth,plot.clientHeight);
      if(!sized){sized=true;chart.timeScale().fitContent()}
    }
    var observer=new ResizeObserver(resize);observer.observe(plot);
    window.addEventListener('resize',resize);requestAnimationFrame(resize);
    window.addEventListener('message',function(event){if(event.source===window.parent&&event.data&&event.data.source==='wavex-app')window.wavexChart.setData(event.data.payload)});
    window.addEventListener('pagehide',function(){observer.disconnect();chart.remove()},{once:true});
    notify({type:'ready'});
  }catch(error){notify({type:'error'})}
})();
</script></body></html>`

export const tradingViewHtml = createTradingViewHtml(colors)
