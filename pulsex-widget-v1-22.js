function createPulsexWidget(options = {}) {
    const settings = {
      pairAddress: options.pool || '0x2Bb9baA3092cE864390bF3e687ABF72bE19E03DC',
      decimals: options.decimals || 6,
      inverted: options.inverted || false,
      stableCoin: options.stableCoin || false,
      containerId: options.containerId || 'pulsex-widget'
    };

    let lastFetchTime = null;
    let firstLoad = true;
    let previousPrice = null;
  
    const widgetContainer = document.getElementById(settings.containerId);
    widgetContainer.className = 'pulsex-widget'; 
    widgetContainer.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
      </div>
      <div class="content">
        <div class="token0-info">
          <img class="token0-logo" src="" alt="" />
          <div class="token0-name"></div>
        </div>
        <div class="price-container">
          <span class="price-info"></span>
          <span class="price-change price-change"></span>
        </div>
        <div class="denominator"></div>
        <div class="marketcap-info"></div>
        <div class="indicator-light green"></div>
      </div>
    `;
  

    async function loadABI(file) {
      const response = await fetch(file);
      return response.json();
    }
  
    const web3 = new Web3('https://rpc.pulsechain.com');
//    widgetContainer.querySelector('.loading').style.display = 'none'; //uncomment to disable loading spinner

  
    Promise.all([
      loadABI('https://testnet.pulsearb.money/katie/ABI/pool.abi.json'), //CHANGE ME
      loadABI('https://testnet.pulsearb.money/katie/ABI/erc20.abi.json') //CHANGE ME
    ]).then(([pulsexV2PairABI, tokenABI]) => {
      console.log(pulsexV2PairABI);
      const pairContract = new web3.eth.Contract(pulsexV2PairABI, settings.pairAddress);
  
      async function getPoolDetails() {
        try {
          const token0Address = await pairContract.methods.token0().call();
          console.log(token0Address);
          const token1Address = await pairContract.methods.token1().call();
  
          const token0Contract = new web3.eth.Contract(tokenABI, token0Address);
          const token1Contract = new web3.eth.Contract(tokenABI, token1Address);
  
          const [name0, symbol0, decimals0, name1, symbol1] = await Promise.all([
            token0Contract.methods.name().call(),
            token0Contract.methods.symbol().call(),
            token0Contract.methods.decimals().call(),
            token1Contract.methods.name().call(),
            token1Contract.methods.symbol().call()
          ]);
  
          const token0Supply = await getTokenSupply(token0Contract);
          const token0Decimals = BigInt(await token0Contract.methods.decimals().call());
          const token0SupplyInTokens = token0Supply / (BigInt(10) ** token0Decimals);
          const token0DecimalsNumber = Number(token0Decimals);

          const token1Supply = await getTokenSupply(token1Contract);
          const token1Decimals = BigInt(await token1Contract.methods.decimals().call());
          const token1SupplyInTokens = token1Supply / (BigInt(10) ** token1Decimals);
          const token1DecimalsNumber = Number(token1Decimals);


          const token0LogoElement = widgetContainer.querySelector('.token0-logo');
          const token0NameElement = widgetContainer.querySelector('.token0-name');

          // Set the token0 logo and name
          const fallbackToken0LogoSrc = `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/${token0Address}/logo.png`;
          const trustWalletToken0LogoSrc = `https://tokens.app.pulsex.com/images/tokens/${token0Address}.png`;

          setImageOrFallback(token0LogoElement, trustWalletToken0LogoSrc, fallbackToken0LogoSrc);
          token0NameElement.innerText = `${name0} (${symbol0})`;
  
          const reserves = await pairContract.methods.getReserves().call();
          const _reserve0 = BigInt(reserves._reserve0);
          const _reserve1 = BigInt(reserves._reserve1);
          
          const readableReserve0 = Number(_reserve0) / (10 ** token0DecimalsNumber);
          const readableReserve1 = Number(_reserve1) / (10 ** token1DecimalsNumber);
          
          const ratio = readableReserve1 / readableReserve0;

          let priceChange = 0;
          if (previousPrice !== null) {
            priceChange = ((ratio - previousPrice) / previousPrice) * 100;
          }
          previousPrice = ratio; // Store the current price for the next comparison
          
      
          marketcap = Number(token0SupplyInTokens) * ratio;
          
          const marketcapFormatted = formatNumberWithSuffix(marketcap);
          
        

          const priceInfo = widgetContainer.querySelector('.price-info');
          const denominator = widgetContainer.querySelector('.denominator');
          const marketcapInfo = widgetContainer.querySelector('.marketcap-info');

          // Calculate the block number from 24 hours ago
          const currentBlockNumber = await web3.eth.getBlockNumber();
          const blocksPerDay = 24 * 60 * 60 / 10; // 10-second block time
          const blockNumber24hAgo = Number(currentBlockNumber) - Number(blocksPerDay);
          console.log(blockNumber24hAgo)


          // Fetch reserves from 24 hours ago
          const oldReserves = await pairContract.methods.getReserves().call(undefined, blockNumber24hAgo);
          const oldReserve0 = BigInt(oldReserves._reserve0);
          const oldReserve1 = BigInt(oldReserves._reserve1);

          // Calculate the price ratio from 24 hours ago
          const oldReadableReserve0 = Number(oldReserve0) / (10 ** token0DecimalsNumber);
          const oldReadableReserve1 = Number(oldReserve1) / (10 ** token1DecimalsNumber);
          const oldRatio = oldReadableReserve1 / oldReadableReserve0;          

          // Calculate the price change percentage
          const priceChange24h = ((ratio - oldRatio) / oldRatio) * 100;

          // Display the price change
          const priceChangeElement = widgetContainer.querySelector('.price-change');
          priceInfo.innerText = `${ratio.toFixed(settings.decimals)}`;
          priceChangeElement.innerText = `(${priceChange24h >= 0 ? '+' : ''}${priceChange24h.toFixed(2)}%)`;
          priceChangeElement.className = `price-change ${priceChange24h >= 0 ? 'positive' : 'negative'}`;
          
          if (firstLoad) {
            widgetContainer.querySelector('.loading').style.display = 'none'; // Fixed
            firstLoad = false; // Ensure that this code only runs once
          }
      
          priceInfo.innerText = `${ratio.toFixed(settings.decimals)}`;
          denominator.innerText = `${settings.inverted ? symbol0 : symbol1}`;
          marketcapInfo.innerText = `Market Cap: ${marketcapFormatted}`;
          lastFetchTime = Date.now();   
          widgetContainer.querySelector('.content').style.opacity = '1'; // Fixed
      
  
          // Other code to update the UI
        } catch (error) {
          console.error("An error occurred while fetching the pool details:", error);
        }
      }
  
      function formatNumberWithSuffix(number) {
        if (number >= 1e12) return (number / 1e12).toFixed(2) + ' T';
        if (number >= 1e9) return (number / 1e9).toFixed(2) + ' B';
        if (number >= 1e6) return (number / 1e6).toFixed(2) + ' M';
        if (number >= 1e3) return (number / 1e3).toFixed(2) + ' K';
        return number.toFixed(2);
      }

      function setImageOrFallback(img, primarySrc, fallbackSrc) {
        let fallbackAttempted = false;
        
        img.onload = () => {
          if (img.width > 0 && img.height > 0) {
            img.src = primarySrc;
          } else if (!fallbackAttempted) {
            img.src = fallbackSrc;
            fallbackAttempted = true;
          }
        };
      
        img.onerror = () => {
          if (!fallbackAttempted) {
            img.src = fallbackSrc;
            fallbackAttempted = true;
          }
        };
        
        img.src = primarySrc;
      }
      

      function updateIndicatorLight() {
        console.log('updating IndicatorLight');
        const indicatorLight = widgetContainer.querySelector('.indicator-light');
        if (lastFetchTime === null) {
          indicatorLight.classList.remove('green');
          indicatorLight.classList.add('yellow');
          indicatorLight.title = 'Loading or never fetched';
        } else {
          const secondsSinceLastFetch = (Date.now() - lastFetchTime) / 1000;
          if (secondsSinceLastFetch < 12) {
            indicatorLight.classList.remove('yellow');
            indicatorLight.classList.add('green');
            indicatorLight.title = `Price fetched ${secondsSinceLastFetch.toFixed(1)} seconds ago`;
          } else if (secondsSinceLastFetch >= 12) {
            indicatorLight.classList.remove('green');
            indicatorLight.classList.add('yellow');
            indicatorLight.title = `Price fetched ${secondsSinceLastFetch.toFixed(1)} seconds ago`;
          }
        }
      }
      
      
  
      async function getTokenSupply(tokenContract) {
        try {
          const totalSupply = BigInt(await tokenContract.methods.totalSupply().call());
          return totalSupply;
        } catch (error) {
          console.error("An error occurred while fetching the total supply:", error);
          return null;
        }
      }
      getPoolDetails();
      setInterval(getPoolDetails, 10000); // Fetch every 10 seconds
      setInterval(updateIndicatorLight, 1000); // Update traffic light every second

    });
  }
  
 
window.createPulsexWidget = createPulsexWidget;
  
