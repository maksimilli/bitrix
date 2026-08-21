export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Согласование</title>
    <script src="//api.bitrix24.com/api/v1/"></script>
    <style>
        body { margin: 0; padding: 10px; font-family: system-ui, -apple-system, sans-serif; }
        .btn-container { display: flex; gap: 8px; align-items: center; }
        .action-btn { border: none; padding: 7px 14px; border-radius: 3px; font-weight: bold; font-size: 12px; cursor: pointer; color: #fff; transition: opacity 0.2s; }
        .action-btn:hover { opacity: 0.85; }
        .action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .btn-approve { background-color: #2fc6f6; }
        .btn-notes { background-color: #f7a700; }
        .btn-reject { background-color: #ff5752; }
        .bind-btn { background-color: #7bd500; margin-top: 10px; padding: 10px; cursor: pointer; border: none; color: white; font-weight: bold; border-radius: 3px; }
    </style>
</head>
<body>

<div class="btn-container">
    <button class="action-btn btn-approve" onclick="onDecision('APPROVE')">Согласовать</button>
    <button class="action-btn btn-notes" onclick="onDecision('NOTES')">Согласовать с замечаниями</button>
    <button class="action-btn btn-reject" onclick="onDecision('REJECT')">Отклонить</button>
</div>

<div style="margin-top: 20px; padding: 15px; border: 1px dashed #ccc; border-radius: 5px; background: #f9f9f9;">
    <h4>Привязка к задачам:</h4>
    <button class="bind-btn" onclick="autoBind()">Запустить автоматическую привязку</button>
    <div id="log" style="margin-top: 15px; font-weight: bold; white-space: pre-wrap;"></div>
</div>

<script>
    let taskId = null;

    BX24.init(function() {
        var options = BX24.placement.info().options;
        taskId = options ? options.taskId : null;
    });

    function autoBind() {
        var logDiv = document.getElementById('log');
        logDiv.style.color = 'black';
        logDiv.innerText = 'Начинаем привязку...\n';

        var placementsToTry = [
            'TASK_USER_FIELD',
            'TASK_CARD_TOP_PANEL',
            'TASK_VIEW_MODE'
        ];

        function tryNext(index) {
            if (index >= placementsToTry.length) {
                logDiv.innerHTML += '<br><span style="color:red;">❌ Имена мест не поддерживаются напрямую через REST. Переходим к плану "Пользовательское поле"!</span>';
                return;
            }

            var pCode = placementsToTry[index];
            logDiv.innerText += 'Пробуем: ' + pCode + '... ';

            BX24.callMethod(
                'placement.bind',
                {
                    'PLACEMENT': pCode,
                    'HANDLER': 'https://bitrix-bay.vercel.app',
                    'TITLE': 'Согласование'
                },
                function(res) {
                    if (res.error()) {
                        var err = res.error();
                        var errMsg = err.ex ? (err.ex.error_description || err.ex.error) : JSON.stringify(err);
                        logDiv.innerHTML += '<span style="color:red;">Ошибка (' + errMsg + ')</span>\n';
                        tryNext(index + 1);
                    } else {
                        logDiv.innerHTML += '<span style="color:green;">УСПЕХ! Привязано к ' + pCode + '!</span>\n';
                    }
                }
            );
        }

        tryNext(0);
    }

    function setButtonsLoading(loading) {
        document.querySelectorAll('.action-btn').forEach(function(btn) { btn.disabled = loading; });
    }

    function onDecision(type) {
        if (!taskId) {
            alert('Не найден ID задачи.');
            return;
        }

        let comment = '';
        if (type === 'NOTES') {
            comment = prompt('Укажите замечания к документу:');
            if (comment === null) return;
        } else if (type === 'REJECT') {
            comment = prompt('Укажите причину отклонения:');
            if (comment === null) return;
        }

        setButtonsLoading(true);

        BX24.callMethod('tasks.task.get', { id: taskId, select: ['ID', 'UF_CRM_TASK'] }, function(resTask) {
            if (resTask.error()) {
                alert('Ошибка получения задачи: ' + resTask.error());
                setButtonsLoading(false);
                return;
            }

            var taskData = resTask.data().task;
            var crmFields = taskData.ufCrmTask || [];
            var smartBinding = null;
            
            for (var i = 0; i < crmFields.length; i++) {
                if (typeof crmFields[i] === 'string' && crmFields[i].indexOf('T') === 0) {
                    smartBinding = crmFields[i];
                    break;
                }
            }

            var statusText = '';
            if (type === 'APPROVE') {
                statusText = '✅ Документ СОГЛАСОВАН.';
            } else if (type === 'NOTES') {
                statusText = '⚠️ Документ СОГЛАСОВАН С ЗАМЕЧАНИЯМИ:\\n' + comment;
            } else if (type === 'REJECT') {
                statusText = '❌ Документ ОТКЛОНЕН.\\nПричина: ' + comment;
            }

            BX24.callMethod('task.commentitem.add', [taskId, { POST_MESSAGE: statusText }], function() {
                if (smartBinding) {
                    var parts = smartBinding.substring(1).split('_');
                    BX24.callMethod('crm.timeline.comment.add', {
                        fields: {
                            ENTITY_ID: parts[1],
                            ENTITY_TYPE: 'dynamic_' + parts[0],
                            COMMENT: statusText
                        }
                    });
                }

                BX24.callMethod('tasks.task.complete', { id: taskId }, function() {
                    BX24.reloadWindow();
                });
            });
        });
    }
</script>

</body>
</html>`;

  res.status(200).send(html);
}
