# AI女友

## 构建打包

现在 Expo 官方主推的打包方式是 EAS Build（云端构建服务），它比旧版的 expo build更强大且支持自定义原生代码。以下是为你整理的打包步骤：

### 1. 安装与登录

首先确保你全局安装了 EAS CLI 并登录了 Expo 账号（没有的话去官网注册一个）：

```
# 安装 EAS 命令行工具
npm install -g eas-cli

# 登录你的 Expo 账号
eas login
```

### 2. 初始化配置

在项目根目录下运行以下命令，它会自动创建 eas.json配置文件，并帮你注册应用：

```
eas build:configure
```

运行后根据终端提示操作即可，通常直接回车选默认就行。

### 3. 开始打包

你可以选择同时打两个平台的包，或者分开打。
同时构建安卓和 iOS：

```
eas build --platform all
```

仅构建安卓：

```
eas build --platform android
```

仅构建 iOS：

```
eas build --platform ios
```

执行命令后，代码会被上传到 Expo 的云端服务器进行编译。你可以在终端看到进度，或者点击输出的链接去网页端看日志。

### 4. 获取安装包

构建完成后，终端会给出一个下载链接：
安卓：直接下载 .apk文件安装到手机测试，或者下载 .aab文件提交到 Google Play 。
iOS：会生成 .ipa文件。如果是真机测试，通常需要配合 TestFlight 或内部分发 。

💡 两个实用小贴士

#### 1.想要直接安装的安卓包？

默认打出来的是给商店用的 .aab。如果你只是想发给同事直接安装测试，可以在运行命令时指定配置：

```
eas build -p android --profile preview
```

打包出来的是.apk文件

#### 2.iOS 打包限制

构建 iOS 的 .ipa包必须要有 Apple Developer Program​ 付费账号（99美元/年）来配置签名证书。如果是免费账号，通常只能打模拟器版本 。
