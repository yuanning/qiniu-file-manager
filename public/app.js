document.addEventListener('DOMContentLoaded', function() {
  // DOM元素引用
  const fileContent = document.getElementById('fileContent');
  const breadcrumb = document.getElementById('breadcrumb');
  const audioPlayer = document.getElementById('audioPlayer');
  const audioElement = document.getElementById('audioElement');
  const currentAudioName = document.getElementById('currentAudioName');
  const closePlayer = document.getElementById('closePlayer');
  
  // 当前路径
  let currentPath = '';
  
  // 初始化加载根目录文件
  loadFiles('');
  
  // 加载文件列表
  function loadFiles(prefix) {
    // 更新当前路径
    currentPath = prefix;
    
    // 显示加载状态
    fileContent.innerHTML = `
      <div class="loading">
        <div class="loading-spinner"></div>
        <p>正在加载文件...</p>
      </div>
    `;
    
    // 构建API请求URL
    let url = '/api/files';
    if (prefix) {
      url += `?prefix=${encodeURIComponent(prefix)}`;
    }
    
    // 发送API请求
    fetch(url)
      .then(response => {
        if (!response.ok) {
          throw new Error('网络请求失败');
        }
        return response.json();
      })
      .then(data => {
        if (data.success) {
          renderFiles(data.data);
          updateBreadcrumb(data.data.currentPrefix);
        } else {
          showError(data.message || '获取文件列表失败');
        }
      })
      .catch(error => {
        console.error('加载文件失败:', error);
        showError('加载文件失败: ' + error.message);
      });
  }
  
  // 渲染文件列表
  function renderFiles(data) {
    const { files, folders } = data;
    
    // 先渲染文件夹，再渲染文件
    const allItems = [...folders, ...files].sort((a, b) => {
      // 文件夹排在前面
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      // 相同类型按名称排序
      return a.name.localeCompare(b.name);
    });
    
    if (allItems.length === 0) {
      fileContent.innerHTML = `
        <div class="empty-state">
          <i>📁</i>
          <p>当前目录为空</p>
        </div>
      `;
      return;
    }
    
    // 构建文件列表HTML
    let html = '';
    
    allItems.forEach(item => {
      if (item.isFolder) {
        // 文件夹
        html += `
          <div class="file-item" data-type="folder" data-key="${item.key}">
            <div class="file-name">
              <span class="file-icon folder-icon">📁</span>
              ${item.name || '(空文件夹)'}
            </div>
            <div class="file-size"></div>
            <div class="file-type">文件夹</div>
            <div class="file-action"></div>
          </div>
        `;
      } else {
        // 文件
        const fileSize = formatFileSize(item.size);
        const fileType = item.isAudio ? '音频文件' : '其他文件';
        const actionButton = item.isAudio ? 
          `<button class="action-btn play-btn" data-url="${item.url}" data-name="${item.name}" data-key="${item.key}">播放</button>` : '';
        
        html += `
          <div class="file-item" data-type="file" data-key="${item.key}">
            <div class="file-name">
              <span class="file-icon ${item.isAudio ? 'audio-icon' : ''}">${item.isAudio ? '🎵' : '📄'}</span>
              ${item.name}
            </div>
            <div class="file-size">${fileSize}</div>
            <div class="file-type">${fileType}</div>
            <div class="file-action">${actionButton}</div>
          </div>
        `;
      }
    });
    
    fileContent.innerHTML = html;
    
    // 添加事件监听
    addEventListeners();
  }
  
  // 添加事件监听器
  function addEventListeners() {
    // 文件夹点击事件
    document.querySelectorAll('.file-item[data-type="folder"]').forEach(folder => {
      folder.addEventListener('click', function() {
        const folderKey = this.getAttribute('data-key');
        loadFiles(folderKey);
      });
    });
    
    // 文件点击事件（非音频文件）
    document.querySelectorAll('.file-item[data-type="file"]:not(:has(.play-btn))').forEach(file => {
      file.addEventListener('click', function() {
        const fileKey = this.getAttribute('data-key');
        const fileName = this.querySelector('.file-name').textContent.trim();
        alert(`您点击了文件：${fileName}\n文件Key：${fileKey}`);
      });
    });
    
    // 播放按钮点击事件
    document.querySelectorAll('.play-btn').forEach(button => {
      button.addEventListener('click', function(e) {
        e.stopPropagation(); // 阻止冒泡，避免触发文件项的点击事件
        const audioUrl = this.getAttribute('data-url');
        const audioName = this.getAttribute('data-name');
        const audioKey = this.getAttribute('data-key');
        playAudio(audioUrl, audioName, audioKey);
      });
    });
  }
  
  // 播放音频
  function playAudio(url, name, key) {
    // 显示播放器
    audioPlayer.classList.add('show');
    currentAudioName.textContent = name;
    
    // 清除之前的所有监听器
    audioElement.removeAttribute('src');
    
    // 重置音频元素
    audioElement.load();
    
    // 显示调试信息
    console.log('===== 音频播放调试信息 =====');
    console.log('文件名:', name);
    console.log('文件Key:', key);
    console.log('原始URL:', url);
    console.log('当前页面协议:', window.location.protocol);
    
    // 创建代理URL，通过后端API转发请求，解决混合内容问题
    const proxyUrl = `/api/proxy/${encodeURIComponent(key)}`;
    console.log('使用代理URL:', proxyUrl);
    
    // 使用代理URL替代原始URL
    url = proxyUrl;
    
    // 添加所有事件监听器
    audioElement.addEventListener('loadstart', function() { console.log('音频开始加载...'); });
    audioElement.addEventListener('progress', function() { console.log('音频加载中...'); });
    audioElement.addEventListener('suspend', function() { console.log('音频加载暂停...'); });
    audioElement.addEventListener('abort', function() { console.log('音频加载中断...'); });
    audioElement.addEventListener('error', handleAudioError);
    audioElement.addEventListener('emptied', function() { console.log('音频数据已清空...'); });
    audioElement.addEventListener('stalled', function() { console.log('音频加载停滞...'); });
    audioElement.addEventListener('loadedmetadata', function() { console.log('音频元数据已加载:', audioElement.duration, '秒'); });
    audioElement.addEventListener('loadeddata', function() { console.log('音频数据已加载...'); });
    audioElement.addEventListener('canplay', function() { console.log('音频可以播放了'); });
    audioElement.addEventListener('canplaythrough', function() { console.log('音频可以完全播放（无需缓冲）'); });
    audioElement.addEventListener('playing', function() { console.log('音频正在播放...'); });
    audioElement.addEventListener('waiting', function() { console.log('音频等待缓冲...'); });
    audioElement.addEventListener('seeking', function() { console.log('正在跳转到指定位置...'); });
    audioElement.addEventListener('seeked', function() { console.log('跳转完成...'); });
    audioElement.addEventListener('ended', function() { console.log('音频播放完毕'); });
    audioElement.addEventListener('durationchange', function() { console.log('音频时长改变:', audioElement.duration, '秒'); });
    audioElement.addEventListener('timeupdate', function() { console.log('播放时间更新:', audioElement.currentTime, '/', audioElement.duration, '秒'); });
    audioElement.addEventListener('play', function() { console.log('音频播放开始'); });
    audioElement.addEventListener('pause', function() { console.log('音频暂停'); });
    audioElement.addEventListener('ratechange', function() { console.log('播放速率改变:', audioElement.playbackRate); });
    audioElement.addEventListener('volumechange', function() { console.log('音量改变:', audioElement.volume); });
    
    // 先检查URL是否有效
    checkUrlValidity(url).then(isValid => {
      if (isValid) {
        console.log('URL有效性检查通过，尝试加载音频...');
        audioElement.src = url;
        
        // 自动播放（可能会被浏览器策略阻止）
        tryAutoPlay();
      } else {
        console.warn('URL有效性检查失败，尝试使用临时URL...');
        fetchTempUrlAndPlay(key, name);
      }
    }).catch(err => {
      console.error('URL检查出错:', err);
      alert('URL检查出错: ' + err.message);
      fetchTempUrlAndPlay(key, name);
    });
  }
  
  // 处理音频错误
  function handleAudioError(e) {
    console.error('音频加载/播放失败:', e);
    console.error('错误代码:', e.target.error.code);
    
    let errorMsg = '';
    switch (e.target.error.code) {
      case e.target.error.MEDIA_ERR_ABORTED:
        errorMsg = '用户中止了音频加载';
        break;
      case e.target.error.MEDIA_ERR_NETWORK:
        errorMsg = '网络错误导致音频加载失败';
        break;
      case e.target.error.MEDIA_ERR_DECODE:
        errorMsg = '音频解码失败（格式不支持或文件损坏）';
        break;
      case e.target.error.MEDIA_ERR_SRC_NOT_SUPPORTED:
        errorMsg = '音频源不受支持';
        break;
      default:
        errorMsg = '未知的音频错误';
    }
    
    alert('音频播放失败: ' + errorMsg + '\n请查看控制台获取详细信息。');
  }
  
  // 检查URL有效性 - 使用代理URL进行验证
  function checkUrlValidity(url) {
    return new Promise((resolve) => {
      // 不使用原始URL进行验证，因为它可能是HTTP的
      // 直接返回true，因为我们会使用代理API
      console.log('跳过原始URL验证，将使用代理API');
      resolve(true);
    });
  }
  
  // 尝试自动播放
  function tryAutoPlay() {
    try {
      audioElement.play().then(() => {
        console.log('自动播放成功！');
      }).catch(err => {
        console.warn('自动播放被阻止，用户需要手动点击播放:', err);
        alert('自动播放被浏览器阻止，请点击播放器上的播放按钮。\n\n这是浏览器的安全策略，\n请尝试点击播放器中的播放按钮开始播放。');
      });
    } catch (error) {
      console.error('播放音频失败:', error);
      alert('播放音频时发生错误: ' + error.message);
    }
  }
  
  // 获取临时URL并播放 - 增强版
  function fetchTempUrlAndPlay(key, name) {
    console.log('===== 尝试获取临时URL =====');
    console.log('文件Key:', key);
    console.log('文件名:', name);
    
    // 显示获取临时链接的进度提示
    showStatusMessage('正在获取临时播放链接，请稍候...');
    
    // 构建API URL，注意这里不需要再次encodeURIComponent，因为fetch会自动处理
    const tempUrlApi = `/api/temp-url/${encodeURIComponent(key)}`;
    console.log('临时URL API地址:', tempUrlApi);
    
    // 创建一个可取消的fetch请求
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 增加到15秒超时
    
    fetch(tempUrlApi, {
      signal: controller.signal,
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    })
      .then(response => {
        clearTimeout(timeoutId);
        console.log('临时URL请求响应状态:', response.status);
        console.log('临时URL请求响应类型:', response.headers.get('content-type'));
        
        if (!response.ok) {
          throw new Error(`HTTP错误! 状态码: ${response.status}`);
        }
        
        return response.json().catch(err => {
          console.error('JSON解析错误:', err);
          // 尝试获取原始响应文本
          return response.text().then(text => {
            console.log('原始响应文本:', text);
            throw new Error(`无效的JSON响应: ${text.substring(0, 100)}...`);
          });
        });
      })
      .then(data => {
        console.log('临时URL API响应:', data);
        
        // 显示调试信息
        if (data.debug) {
          console.log('===== 调试信息 =====');
          console.log('配置状态:', data.debug);
        }
        
        if (data.success) {
          console.log('临时URL获取成功:', data.data.url);
          
          // 验证临时URL是否有效
          testTempUrl(data.data.url).then(isValid => {
            if (isValid) {
              // 清空之前的src
              audioElement.src = '';
              audioElement.load();
              // 设置新的src
              audioElement.src = data.data.url;
              
              // 显示临时URL和播放器操作指南
              alert(`临时链接已生成！\n\nURL: ${data.data.url.substring(0, 100)}...\n\n请点击播放器上的播放按钮开始播放\n\n如果仍然无法播放，请右键复制以下URL，\n在新标签页中直接访问或下载音频文件。`);
            } else {
              console.error('临时URL验证失败');
              alert(`临时URL生成失败或无效:\n${data.data.url.substring(0, 100)}...\n\n请检查七牛云配置是否正确，\n并确保存储空间的访问权限设置正确。`);
            }
          }).catch(err => {
            console.error('临时URL验证错误:', err);
            alert(`临时URL验证出错: ${err.message}\n\n请尝试右键复制以下URL在新标签页打开:\n${data.data.url.substring(0, 100)}...`);
          });
        } else {
          console.error('获取临时URL失败:', data.message);
          // 显示详细的错误信息和调试数据
          let errorDetails = '';
          if (data.debug) {
            errorDetails = '\n\n调试信息:\n';
            for (const [key, value] of Object.entries(data.debug)) {
              errorDetails += `${key}: ${value}\n`;
            }
          }
          alert(`获取临时链接失败:\n${data.message}${errorDetails}\n\n请检查服务器日志以获取详细信息。`);
        }
      })
      .catch(err => {
        clearTimeout(timeoutId);
        console.error('获取临时URL请求失败:', err);
        
        let errorMsg = '获取临时链接请求失败';
        if (err.name === 'AbortError') {
          errorMsg = '获取临时链接超时（15秒），服务器可能无响应';
        } else if (err.message) {
          errorMsg += ': ' + err.message;
        }
        
        alert(`${errorMsg}\n\n请检查以下几点:\n1. Vercel服务器是否正常运行\n2. 七牛云配置是否正确（环境变量是否设置）\n3. 网络连接是否正常\n4. 浏览器控制台中是否有更多错误信息`);
        console.error('详细错误:', err);
      })
      .finally(() => {
        hideStatusMessage();
      });
  }
  
  // 测试临时URL是否有效
  function testTempUrl(url) {
    return new Promise((resolve) => {
      console.log('开始验证临时URL:', url);
      const xhr = new XMLHttpRequest();
      xhr.open('HEAD', url, true);
      xhr.timeout = 5000;
      
      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
          console.log('临时URL验证结果:', xhr.status);
          resolve(xhr.status === 200);
        }
      };
      
      xhr.ontimeout = function() {
        console.log('临时URL验证超时');
        resolve(false);
      };
      
      xhr.onerror = function() {
        console.log('临时URL验证错误');
        resolve(false);
      };
      
      xhr.send();
    });
  }
  
  // 显示状态消息
  function showStatusMessage(message) {
    // 创建状态消息元素（如果不存在）
    let statusElement = document.getElementById('status-message');
    if (!statusElement) {
      statusElement = document.createElement('div');
      statusElement.id = 'status-message';
      statusElement.className = 'status-message';
      document.body.appendChild(statusElement);
    }
    
    statusElement.textContent = message;
    statusElement.style.display = 'block';
  }
  
  // 隐藏状态消息
  function hideStatusMessage() {
    const statusElement = document.getElementById('status-message');
    if (statusElement) {
      statusElement.style.display = 'none';
    }
  }
  
  // 更新面包屑导航
  function updateBreadcrumb(currentPrefix) {
    // 清空面包屑
    breadcrumb.innerHTML = '<span class="breadcrumb-item" data-path="">首页</span>';
    
    if (!currentPrefix) return;
    
    // 分割路径并生成面包屑
    const parts = currentPrefix.split('/').filter(part => part);
    let currentPath = '';
    
    parts.forEach((part, index) => {
      currentPath += part + '/';
      
      const breadcrumbItem = document.createElement('span');
      breadcrumbItem.className = 'breadcrumb-item';
      breadcrumbItem.setAttribute('data-path', currentPath);
      breadcrumbItem.textContent = part;
      
      breadcrumbItem.addEventListener('click', function() {
        const path = this.getAttribute('data-path');
        loadFiles(path);
      });
      
      breadcrumb.appendChild(breadcrumbItem);
    });
  }
  
  // 关闭播放器
  closePlayer.addEventListener('click', function() {
    audioPlayer.classList.remove('show');
    audioElement.pause();
    audioElement.src = '';
  });
  
  // 格式化文件大小
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  // 显示错误信息
  function showError(message) {
    fileContent.innerHTML = `
      <div class="error-message">
        <p>❌ ${message}</p>
        <p>请检查.env文件中的七牛云配置是否正确，并确保您的服务器可以连接到七牛云API。</p>
      </div>
    `;
  }
  
  // 处理面包屑点击事件
  breadcrumb.addEventListener('click', function(e) {
    if (e.target.classList.contains('breadcrumb-item')) {
      const path = e.target.getAttribute('data-path');
      loadFiles(path);
    }
  });
});