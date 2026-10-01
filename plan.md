4. Have a simple route - private and public (Auth)
5. AI chat - before we need to check if covered base setup

6. State manager (Redux or just investigate if we need to have this in next project)

Тобто мінімальний реальний прогін:
/grill-me → загострити (ти)
/speckit-specify "..." → читаєш spec.md, правиш ← гейт
/speckit-clarify → добиває дірки
/speckit-plan → читаєш plan.md + constitution check ← гейт
/speckit-tasks
/speckit-analyze → одна перевірка узгодженості
/speckit-implement → тут можна автомод

ПРОМПТ ДЛЯ ФІЧ
Нам не треба супер все укладнювати має бути все в найкращих практиках - мінімум коду і  
все найважливіше. Кінцевим результатом має бути промпт для команти speckit-specify який я запущу окремо
