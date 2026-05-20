import requests
import json
import os

def load_concepts():
    """Загрузить концепты из concepts.json в Memgraph через API"""
    
    json_file_path = os.path.join(os.path.dirname(__file__), 'concepts.json')
   
    if not os.path.exists(json_file_path):
        print(f"Ошибка: Файл {json_file_path} не найден")
        return False
  
    with open(json_file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print(f"Загружено {len(data)} концептов из файла")
    
    try:
        response = requests.post(
            'http://localhost:8000/api/load-concepts/',
            json=data,
            headers={'Content-Type': 'application/json'}
        )
        
        if response.status_code == 200:
            print("Успешно загружено!")
            print(response.json())
            return True
        else:
            print(f"Ошибка: {response.status_code}")
            print(response.text)
            return False
            
    except requests.exceptions.ConnectionError:
        print("Ошибка: Сервер не запущен. Запустите Django: python manage.py runserver")
        return False

if __name__ == "__main__":
    load_concepts()