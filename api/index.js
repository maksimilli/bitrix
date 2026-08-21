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
        html, body {
            margin: 0;
            padding: 10px;
            font-family: system-ui, -apple-system, sans-serif;
            background: #ffffff;
            width: 100%;
            height: auto;
            overflow: visible;
        }
        .btn-container { 
            display: flex; 
            gap: 8px; 
            align-items: center; 
            margin-bottom: 15px;
        }
        .action-btn { 
            border: none; 
            padding: 8px 16px; 
            border-radius: 4px; 
            font-weight: bold; 
            font-size: 13px; 
            cursor: pointer; 
            color: #fff;
        }
        .btn-approve { background-color: #2fc6f6; }
        .btn-notes { background-color: #f7a700; }
        .btn-reject { background-color: #ff5752; }
        
        .bind-box {
            padding: 15px; 
            border: 1px dashed #ccc; 
            border-radius: 5px; 
            background: #f9f9f9;
        }
        .bind-btn { 
            background-color: #7bd500; 
            padding: 10px 15px; 
            cursor: pointer; 
            border: none; 
            color: white; 
            font-weight: bold; 
            border-radius: 4px; 
        }
    </style>
</head>
<body>

<div class="btn-container">
    <button class="action-btn btn-approve" onclick="onDecision('APPROVE')">Согласовать</button>
    <button class="action-btn btn-notes" onclick="onDecision('NOTES')">Согласовать с замечаниями</button>
    <button class="action-btn btn-reject" onclick="onDecision('REJECT')">Отклонить</button>
</div>

<div class="bind-box">
    <h4 style="margin-top:0;">Настройка связи с Битрикс24:</h4>
    <button class="bind-btn" onclick="autoBind()">1. Запустить привязку</button>
    <div id="log" style="margin-top: 15px; font-weight: bold; white-space: pre-wrap; font-size: 13px;"></div>
</div>

<script>
    let taskId = null;

    function resizeApp() {
        if (typeof BX24 !== 'undefined') {
            BX24.resizeWindow(document.documentElement.scrollWidth, 350);
            BX24.fitWindow();
        }
    }

    if (typeof BX24 !== 'undefined') {
        BX24.init(function() {
            var options = BX24.placement.info().options;
            taskId = options ? options.taskId : null;
            resizeApp();
        });
    }

    // Принудительный подгон размера через 0.5с после загрузки
    window.addEventListener('load', function() {
        setTimeout(resizeApp, 500);
    });

    function autoBind() {
        var logDiv = document.getElementById('log');
        logDiv.style.color = 'black';
        logDiv.innerText = 'Запуск проверки мест привязки...\n';

        if (typeof BX24 === 'undefined') {
            logDiv.innerHTML = '<span style="color:red;">❌ BX24 не подгрузился.</span>';
            return;
        }

        var placementsToTry = [
            'TASK_USER_FIELD',
            'TASK_CARD_TOP_PANEL',
            'TASK_VIEW_MODE'
        ];

        function tryNext(index) {
            if (index >= placementsToTry.length) {
                logDiv.innerHTML += '<br><span style="color:red;">❌ Нет поддерживаемых мест в этой редакции.</span>';
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

    function onDecision(type) {
        if (!taskId) {
            alert('Приложение открыто вне задачи.');
            return;
        }

        let comment = '';
        if (type === 'NOTES') {
            comment = prompt('Укажите замечания:');
            if (comment === null) return;
        } else if (type === 'REJECT') {
            comment = prompt('Укажите причину:');
            if (comment === null) return;
        }

        BX24.callMethod('tasks.task.get', { id: taskId, select: ['ID', 'UF_CRM_TASK'] }, function(resTask) {
            if (resTask.error()) {
                alert('Ошибка: ' + resTask.error());
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
