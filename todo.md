# Project TODO

- [x] Database schema design (analysis_records, game_stats tables)
- [x] Global styling - blueprint/technical aesthetic with grid background
- [x] Dashboard layout with sidebar navigation
- [x] Screenshot upload page with drag-and-drop support
- [x] AI image recognition engine (LLM vision for card identification)
- [x] Hu-xi (胡息) auto-calculation engine
- [x] Optimal strategy suggestion with AI reasoning
- [x] Rules library page (complete Guilin Feifei rules, hu-xi table, ghost card rules)
- [x] Analysis history page with saved records
- [x] Voice announcement for AI suggestions (TTS)
- [x] Data report page (win rate stats, common mistakes analysis)
- [x] Virtual practice mode (AI opponent simulation)
- [x] Unit tests for core features
- [x] Real-time screen capture via browser Screen Sharing API (getDisplayMedia)
- [x] Auto-periodic screenshot capture (every 2-3 seconds)
- [x] Image change detection to avoid redundant AI calls
- [x] Auto-trigger AI analysis when board state changes
- [x] Real-time overlay display of AI suggestions
- [x] Auto voice announcement on new suggestions
- [x] Start/Stop controls for live analysis session
- [x] Throttle/debounce backend calls for performance
- [x] Rewrite AI analysis prompt with complete accurate rules from user
- [x] Embed exact hu-xi calculation table in prompt (碰大3小1, 坎偎大6小3, 跑大9小6, 提大12小9, 123大6小3, 270大6小3)
- [x] Improve card recognition accuracy (distinguish 大字/小字 correctly)
- [x] Add chi/peng/pass decision analysis when action buttons visible
- [x] Add hu-xi improvement path suggestion (how to increase hu-xi toward 10)
- [x] Include feifei (ghost card) optimal usage analysis
- [x] Fix card display in HAND section (show proper Chinese characters not +)

- [x] Add dianpao defense system (点炮4x, 自摸2x, 自然胡1x scoring)
- [x] Card safety level rating for each discard suggestion (safe/risky/dangerous)
- [x] Auto defense mode when opponent likely near hu
- [x] Expected value calculation (attack gain vs dianpao risk)
- [x] Prioritize recommending already-played cards as safe discards
- [x] Ghost card (鬼牌) complete substitution analysis - list ALL possible replacements with hu-xi
- [x] Ghost card cannot be used for peng, only for hu-pai completion
- [x] Board region identification - clearly separate: my hand, my revealed groups, opponent revealed groups, discard pile, remaining deck
- [x] Identify opponent area (circle avatar) vs my area (square avatar)
- [x] Track discarded cards for safety analysis

- [x] AI逻辑：坎牌锁死效应 - 手上有3张相同牌时，相邻顺子被锁死，相关牌应优先打出
- [x] AI逻辑：胡息够了转快速胡牌模式 - 胡息≥10后从攒胡息转为不漏牌快速组完到底胡

- [x] 深度研究桂林飞飞字牌高级策略（开局/中局/终局/攻防转换）
- [x] 构建完整策略知识库（牌效率、听牌判断、概率计算、弃牌读牌）
- [x] 编写模拟推演引擎（AI自我对局学习最优策略）
- [x] 将策略知识库和推演能力集成到AI分析引擎

- [x] AI核心逻辑重构：从固定牌型分析改为动态穷举所有拆组方案
- [x] 所有牌都可以拆开重新组合，不死守任何已有组合
- [x] 穷举所有可能的组合方式，比较每种方案的胡牌速度
- [x] 1-3秒内计算所有打法，找到最快胡牌路径

- [x] AI逻辑：拆有胡息组合换更快胡牌速度（整体效率优先于单个组合胡息）
- [x] AI逻辑：0胡顺子的散牌消化价值（加速组牌，不能忽视）
- [x] AI逻辑：碰/吃优先级判断（只需碰一个达标即可，十拾等0胡随便吃加速）
- [x] AI逻辑：拆组方案评估标准改为"几步听胡"而非"当前胡息最高"

- [x] 构建字牌计算引擎（TypeScript代码，不是提示词规则）
- [x] 引擎穷举所有拆组方案，自动计算胡息/散牌数/几步听胡/进张数
- [x] 引擎自动排序找出最优方案，支持闲家20张和庄家21张
- [x] LLM只负责识别牌面+生成自然语言建议，计算全部由引擎完成
- [x] 集成引擎到分析流程，引擎结果传给LLM做最终输出

- [x] 引擎BUG修复：大小字同数字可以混组（五伍伍=坎，六六陆=坎）
- [x] 引擎BUG修复：鬼牌灵活充当任何位置（二二鬼=坎3胡，不是提前确定变什么）
- [x] 引擎BUG修复：对子/搭子也是有效牌组（二二=对子，贰拾=搭子等待组合）
- [x] 引擎新增：正确的听牌分析（打1张后来哪些牌能胡，听牌面宽度）
- [x] 引擎新增：胡牌条件 = 所有牌组成有效牌组且胡息≥10

- [x] 引擎规则修正：大小字混组(五伍伍/六六陆)只算组合牌=0胡息
- [x] 引擎规则修正：鬼牌替代后只有形成有胡息牌型才算胡息(二二鬼=坎3胡，鬼叁肆=组合牌0胡)
- [x] 引擎重写：完整的听牌分析（打X后听哪些牌，听牌面宽度）
- [x] 引擎重写：正确的胡牌判定（所有牌组成有效牌组+胡息≥10）

- [x] 引擎V9.0重写：回溯搜索算法，把所有牌当整体递归穷举每种3张组合
- [x] 鬼牌不提前确定，在每次尝试组合时动态决定充当哪张
- [x] 优先找散牌=0的完美拆法（所有牌组完+一对将）
- [x] 在完美拆法中选胡息最高/听牌最宽的方案
- [x] 验证用户实例：打叁后必须找到六七八+四五鬼+陆陆将+听陆的拆法
- [x] 引擎BUG修复：回溯搜索添加跳过分支，能找到所有拆法包含六七八+四五鬼
- [x] 引擎优化：穷举所有0散牌拆法，比较不同拆法的听牌面宽度
- [x] 引擎优化：听牌分析基于所有可能的拆法，支持碰听+自摸听

- [x] BUG：AI推荐打叁，但叁叁叁是6胡坎不应该打掉——排查LLM识别或引擎评估问题
- [x] 引擎规则修正：坎（暗三张）一旦形成不能拆开，必须锁定
- [x] 引擎修改：识别手牌中的坎→自动锁定→只对剩余牌进行回溯搜索
- [x] 修复引擎analyzeHand：自动识别手牌中的坎（3张相同）并锁定，坎牌胡息计入exposedHuxi
- [x] 引擎analyzeTing：跳过坎牌不推荐打出，坎牌胡息传入canHu
- [x] 新增8个坎牌锁定测试用例，73个测试全部通过
- [x] 修复后端路由：分析流程中集成坎牌锁定逻辑（前端展示坎牌信息）
- [x] 修复前端展示：显示坎牌锁定信息、正确胡息、正确推荐打牌
- [x] 修复前端：我方胡息显示要包含坎牌胡息
- [x] BUG：引擎没有处理提牌（4张相同）的锁定逻辑，只处理了坎（3张）
- [x] 引擎添加提牌（4张相同）锁定：提=大字12胡/小字9胡，比坎更不能拆
- [x] LLM建议prompt中传入坎/提锁定信息，防止LLM推荐打锁定牌
- [x] 前端展示提牌锁定信息
- [x] 新增5个提牌锁定测试用例，78个测试全部通过
- [x] 性能优化：去掉Step 3 LLM建议生成（6.5秒），用引擎结果直接生成推荐文本
- [x] 性能优化：总耗时从16秒降到10秒以内
- [x] 前端版本号更新到V9.3
- [x] 清理不再使用的ADVICE_SYSTEM_PROMPT和ADVICE_JSON_SCHEMA
- [x] BUG：LLM识别手牌不准确（把七识别为柒，推荐打柒但手里没有柒）
- [x] 优化LLM识别prompt，增加大小字对照表和最容易混淆的对
- [x] 前端已有[ HAND ]识别手牌展示区域，用户可校验
- [x] 添加手牌校验逻辑：推荐打的牌必须在手牌中，不在则自动修正
- [x] BUG：前端AI分析结果与正确分析不一致（根因：LLM把五识别为伍，导致5张伍异常）
- [x] 优化LLM识别prompt：大幅强化大小字区分说明，每对混淆字详细解释笔画差异
- [x] 添加牌数校验逻辑：每种牌最多4张，超过则自动将多余的转换为对应大/小字

- [x] V10.0: 重写LLM识别prompt，加入逐张识别依据和置信度
- [x] V10.0: 添加手牌手动修正功能（前端点击修改识别错误的牌）
- [x] V10.0: 添加引擎重新计算API（接收修正手牌，跳过LLM识别）
- [x] V10.0: 前端版本号更新到V10.0
- [x] V10.0: 编写手动修正功能的测试（6个新测试用例，84个测试全部通过）

- [x] BUG: AI识别结果与实际手牌不一致，用户无法判断哪些牌识别错了
- [x] 优化前端：分析结果顶部醒目展示AI识别出的完整手牌列表（大字/小字/鬼分类显示）
- [x] 优化前端：识别结果中每张牌显示清晰的大小字标注，方便用户一眼发现错误
- [x] 优化LLM prompt：继续改进LLM识别prompt，加入二次验证机制和自查步骤

- [x] BUG严重: LLM只识别出10张手牌——强化prompt+自动重试+前端警告+手动增删牌
- [x] 优化LLM prompt：强化手牌区域识别，明确要求识别上下两排所有手牌
- [x] 后端添加手牌数量验证：如果识别不到15张，自动重试一次
- [x] 前端添加手牌数量不足警告+手动添加/删除牌功能
- [x] 推荐打牌为空时的前端显示修复（手牌不足时显示警告而非空结果）

- [x] BUG: 实时投屏功能不能用——iframe环境检测+明确提示用户在新窗口打开

- [x] BUG: 傲软投屏窗口捕获空白——添加空白帧检测+提示用户选择“整个屏幕”
- [x] 需求: 分析频率默认改为1秒，选项改为1/2/3/5秒
- [x] 优化: 投屏提示改为“请选择整个屏幕共享”+空白帧自动警告

- [x] BUG: 傲软投屏空白——新增「快捷截图」模式作为替代方案，粘贴截图自动分析
- [x] 新增「快捷截图」模式：监听Ctrl+V粘贴截图，自动触发分析
- [x] 优化投屏模式UI：快捷截图为默认模式，屏幕共享作为备选

- [x] 需求: 实现真正的实时自动分析——剪贴板自动轮询模式
- [x] 方案: 自动剪贴板轮询模式——每1秒读取剪贴板截图并自动分析
- [x] 方案: 剪贴板权限被拒绝时自动回退到Ctrl+V手动粘贴模式

- [x] 需求: 实时监控傲软投屏画面，持续自动分析牌型
- [x] 后端: 添加截图上传REST API端点（/api/screen/upload + /api/screen/latest + /api/screen/stop）
- [x] 后端: 添加轮询端点/api/screen/latest，前端每800ms获取最新截图
- [x] 工具: 编写screen-capture.py截屏脚本（mss截屏+自动上传）
- [x] 前端: 截屏助手模式——实时显示截图+自动分析+安装指南

- [x] BUG: AI识别出21张但实际只有20张——添加庄家/闲家选择+数量不匹配警告
- [x] 需求: 添加庄家(21张)/闲家(20张)选择功能
- [x] 优化: LLM prompt中传入预期手牌数量，严格约束识别数量
- [x] 前端: 手牌数量不匹配时显示醒目警告（区分多识/少识）

- [ ] 将screen-capture.py打包成Windows .exe可执行文件
- [ ] 上传.exe到CDN，前端添加下载链接
- [ ] 更新截屏助手安装指南，添加exe下载选项
