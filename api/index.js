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
        body { margin: 0; padding: 5px; font-family: system-ui, -apple-system, sans-serif; }
        .btn-container { display: flex; gap: 8px; align-items: center; }
        .btn { border: none; padding: 7px 14px; border-radius: 3px; font-weight: bold; font-size: 12px; cursor: pointer; color: #fff; transition: opacity 0.2s; }
        .btn:hover { opacity: 0.85; }
        .btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .btn-approve { background-color: #2fc6f6; }
        .btn-notes { background-color: #f7a700; }
        .btn-reject { background-color: #ff5752; }
    </style>
</head>
<body>

<div class="btn-container">
    <button class="btn btn-approve" id="btn-approve" onclick="onDecision('APPROVE')">Согласовать</button>
    <button class="btn btn-notes" id="btn-notes" onclick="onDecision('NOTES')">Согласовать с замечаниями</button>
    <button class="btn btn-reject" id="btn-reject" onclick="onDecision('REJECT')">Отклонить</button>
</div>

<script>
    let taskId = null;

    BX24.init(function() {
        var options = BX24.placement.info().options;
        taskId = options ? options.taskId : null;

        // Автоматическая регистрация кнопок при открытии страницы приложения
        BX24.callMethod(
            'placement.bind',
            {
                'PLACEMENT': 'TASK_CARD_TOP_PANEL',
                'HANDLER': 'https://bitrix-bay.vercel.app',
                'TITLE': 'Согласование'
            },
            function(res) {
                console.log('РЕЗУЛЬТАТ РЕГИСТРАЦИИ КНОПОК:', res);
            }
        );
    });

    function setButtonsLoading(loading) {
        document.querySelectorAll('.btn').forEach(function(btn) { btn.disabled = loading; });
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
