from gqlalchemy import Memgraph
from typing import List, Dict, Optional
from django.conf import settings

class MemgraphClient:
    def __init__(self):
        self.mg = Memgraph(
            host=settings.MEMGRAPH_CONFIG['host'],
            port=settings.MEMGRAPH_CONFIG['port']
        )
    
    # ========== КОНЦЕПТЫ ==========
    
    def get_concept_with_relations(self, concept_id: int) -> Optional[dict]:
        """Получить концепт со всеми связями (дети + семантические связи)"""
        
        # 1. Получаем концепт
        query_concept = """
        MATCH (c:Concept {id: $id})
        RETURN 
            c.id as id,
            c.ru_name as ru_name,
            c.en_name as en_name,
            c.type as type,
            c.hypernym as hypernym
        """
        concept_results = list(self.mg.execute_and_fetch(query_concept, {'id': concept_id}))
        
        if not concept_results:
            return None
        
        row = concept_results[0]
        result = {
            'id': row['id'],
            'ru_name': row['ru_name'],
            'en_name': row['en_name'],
            'type': row['type'],
            'hypernym': row['hypernym'],
            'children': [],
            'semantic_neighbors': []
        }
        
        # 2. Получаем детей
        query_children = """
        MATCH (child:Concept {hypernym: $id})
        RETURN {
            id: child.id,
            ru_name: child.ru_name,
            en_name: child.en_name,
            type: child.type
        } as child
        """
        children_results = list(self.mg.execute_and_fetch(query_children, {'id': concept_id}))
        result['children'] = [r['child'] for r in children_results if r.get('child')]
        
        # 3. Получаем семантические связи
        query_semantic = """
        MATCH (c:Concept {id: $id})-[r:SEMANTIC]-(neighbor:Concept)
        RETURN {
            id: neighbor.id,
            ru_name: neighbor.ru_name,
            en_name: neighbor.en_name,
            type: neighbor.type,
            relation: TYPE(r)
        } as neighbor
        """
        semantic_results = list(self.mg.execute_and_fetch(query_semantic, {'id': concept_id}))
        result['semantic_neighbors'] = [r['neighbor'] for r in semantic_results if r.get('neighbor')]
        
        return result
    
    def add_concept(self, concept_id: int, ru_name: str, en_name: str, 
                    concept_type: str, hypernym: int = None) -> bool:
        """Создать концепт"""
        query = """
        CREATE (c:Concept {
            id: $id,
            ru_name: $ru_name,
            en_name: $en_name,
            type: $type,
            hypernym: $hypernym
        })
        RETURN c
        """
        self.mg.execute(query, {
            'id': concept_id,
            'ru_name': ru_name,
            'en_name': en_name,
            'type': concept_type,
            'hypernym': hypernym
        })
        return True
    
    def get_all_concepts(self, concept_type: str = None, limit: int = 2000) -> List[dict]:
        """Получить все концепты """
        if concept_type:
            query = """
            MATCH (c:Concept {type: $type})
            RETURN {
                id: c.id,
                ru_name: c.ru_name,
                en_name: c.en_name,
                type: c.type,
                hypernym: c.hypernym
            } as concept
            LIMIT $limit
            """
            results = list(self.mg.execute_and_fetch(query, {'type': concept_type, 'limit': limit}))
        else:
            query = """
            MATCH (c:Concept)
            RETURN {
                id: c.id,
                ru_name: c.ru_name,
                en_name: c.en_name,
                type: c.type,
                hypernym: c.hypernym
            } as concept
            LIMIT $limit
            """
            results = list(self.mg.execute_and_fetch(query, {'limit': limit}))
        
        return [r['concept'] for r in results if r.get('concept')]
    
    def update_concept(self, concept_id: int, new_ru_name: str = None, 
                       new_en_name: str = None, new_type: str = None,
                       new_hypernym: int = None) -> bool:
        """Обновить концепт"""
        updates = []
        params = {'id': concept_id}
        
        if new_ru_name:
            updates.append("c.ru_name = $new_ru_name")
            params['new_ru_name'] = new_ru_name
        if new_en_name:
            updates.append("c.en_name = $new_en_name")
            params['new_en_name'] = new_en_name
        if new_type:
            updates.append("c.type = $new_type")
            params['new_type'] = new_type
        if new_hypernym is not None:
            updates.append("c.hypernym = $new_hypernym")
            params['new_hypernym'] = new_hypernym
        
        if not updates:
            return True
        
        query = f"""
        MATCH (c:Concept {{id: $id}})
        SET {', '.join(updates)}
        RETURN c
        """
        self.mg.execute(query, params)
        return True
    
    def delete_concept(self, concept_id: int) -> bool:
        """Удалить концепт и все его связи"""
        query = "MATCH (c:Concept {id: $id}) DETACH DELETE c RETURN count(c) as deleted"
        results = list(self.mg.execute_and_fetch(query, {'id': concept_id}))
        return results[0]['deleted'] > 0 if results else False
    
    # ========== ИЕРАРХИЯ (ДЕТИ И РОДИТЕЛИ) ==========
    
    def get_children(self, concept_id: int) -> List[dict]:
        """Получить всех детей концепта (один уровень)"""
        query = """
    MATCH (child:Concept {hypernym: $id})
    RETURN {
        id: child.id,
        ru_name: child.ru_name,
        en_name: child.en_name,
        type: child.type,
        hypernym: child.hypernym
    } as child
    """
        results = list(self.mg.execute_and_fetch(query, {'id': concept_id}))
        return [r['child'] for r in results if r.get('child')]

    def get_parent(self, concept_id: int) -> Optional[dict]:
        """Получить родителя концепта (один уровень)"""
        query = """
    MATCH (c:Concept {id: $id})
    WHERE c.hypernym IS NOT NULL
    MATCH (parent:Concept {id: c.hypernym})
    RETURN {
        id: parent.id,
        ru_name: parent.ru_name,
        en_name: parent.en_name,
        type: parent.type,
        hypernym: parent.hypernym
    } as parent
    """
        results = list(self.mg.execute_and_fetch(query, {'id': concept_id}))
        return results[0]['parent'] if results and results[0].get('parent') else None

    def get_children_recursive(self, concept_id: int,max_depth: int = 3) -> List[dict]:
        """Рекурсивно получить всех потомков (все уровни вниз, но с ограничением, чтобы не нагружать бд)"""
        result = []
    
        def collect(parent_id: int, depth: int):
            if depth > max_depth:
                return
            children = self.get_children(parent_id)
            for child in children:
                child['depth'] = depth
                result.append(child)
                collect(child['id'], depth + 1)
    
        collect(concept_id, 1)
        return result

    def get_parents_recursive(self, concept_id: int) -> List[dict]:
        """Рекурсивно получить всех предков (все уровни вверх)"""
        result = []
        current_id = concept_id
        depth = 1
    
        while True:
            parent = self.get_parent(current_id)
            if not parent:
                break
            parent['depth'] = depth
            result.append(parent)
            current_id = parent['id']
            depth += 1
    
        return result
    # ========== СЕМАНТИЧЕСКИЕ СВЯЗИ ==========
    
    def add_semantic_edge(self, from_id: int, to_id: int, relation: str) -> bool:
        """Добавить семантическую связь"""
        query = f"""
        MATCH (from:Concept {{id: $from_id}})
        MATCH (to:Concept {{id: $to_id}})
        CREATE (from)-[:SEMANTIC {{type: $relation}}]->(to)
        RETURN from, to
        """
        self.mg.execute(query, {'from_id': from_id, 'to_id': to_id, 'relation': relation})
        return True
    
    def delete_semantic_edge(self, from_id: int, to_id: int, relation: str = None) -> bool:
        """Удалить семантическую связь"""
        if relation:
            query = """
            MATCH (from:Concept {id: $from_id})-[r:SEMANTIC {type: $relation}]->(to:Concept {id: $to_id})
            DELETE r
            RETURN count(r) as deleted
            """
            self.mg.execute(query, {'from_id': from_id, 'to_id': to_id, 'relation': relation})
        else:
            query = """
            MATCH (from:Concept {id: $from_id})-[r:SEMANTIC]->(to:Concept {id: $to_id})
            DELETE r
            RETURN count(r) as deleted
            """
            self.mg.execute(query, {'from_id': from_id, 'to_id': to_id})
        return True
    
    
    def load_concepts_from_json(self, concepts_data: list) -> dict:
        """Загрузить концепты из JSON"""
        # Очищаем БД
        self.mg.execute("MATCH (n) DETACH DELETE n")
        
        # Создаем все узлы
        for concept in concepts_data:
            self.add_concept(
                concept_id=concept['id'],
                ru_name=concept['ru_name'],
                en_name=concept['en_name'],
                concept_type=concept['type'],
                hypernym=concept.get('hypernym')
            )
        
        return {"status": "success", "nodes_loaded": len(concepts_data)}
    
    # ========== ТЕСТОВЫЕ ДАННЫЕ ==========
    
    def load_test_data(self):
        """Загрузить тестовые данные для проверки"""
        test_data = [
            {"id": 1, "ru_name": "сущность", "en_name": "entity", "type": "object_concept", "hypernym": None},
            {"id": 2, "ru_name": "физическая сущность", "en_name": "physical entity", "type": "object_concept", "hypernym": 1},
            {"id": 3, "ru_name": "абстрактная сущность", "en_name": "abstract entity", "type": "object_concept", "hypernym": 1},
            {"id": 4, "ru_name": "объект", "en_name": "object", "type": "object_concept", "hypernym": 2},
            {"id": 5, "ru_name": "живое существо", "en_name": "living thing", "type": "object_concept", "hypernym": 4},
            {"id": 6, "ru_name": "животное", "en_name": "animal", "type": "object_concept", "hypernym": 5},
            {"id": 7, "ru_name": "собака", "en_name": "dog", "type": "object_concept", "hypernym": 6},
            {"id": 8, "ru_name": "действие", "en_name": "action", "type": "action_concept", "hypernym": None},
            {"id": 9, "ru_name": "быстро", "en_name": "fast", "type": "action_attribute_concept", "hypernym": None},
            {"id": 10, "ru_name": "красный", "en_name": "red", "type": "object_attribute_concept", "hypernym": None},
        ]
        return self.load_concepts_from_json(test_data)
    
    def search_by_russian_word(self, search_term: str, limit: int = 50) -> List[dict]:
        """Поиск концептов по русскому слову (игнорируя описание в скобках)"""
    
        query = """
    MATCH (c:Concept)
    WITH c, 
         split(c.ru_name, '(')[0] AS clean_word
    WHERE toLower(clean_word) CONTAINS toLower($search_term)
    RETURN {
        id: c.id,
        ru_name: c.ru_name,
        en_name: c.en_name,
        type: c.type
    } as concept
    LIMIT $limit
    """
        results = list(self.mg.execute_and_fetch(query, {
            'search_term': search_term,
            'limit': limit
        }))
    
    # Фильтруем None значения
        filtered = []
        for r in results:
            if r.get('concept') and r['concept'].get('id'):
                filtered.append(r['concept'])
    
        return filtered