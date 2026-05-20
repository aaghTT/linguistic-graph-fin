from django.urls import path
from . import views

urlpatterns = [
    # Концепты
    path('concept/<int:concept_id>', views.get_concept, name='get_concept'),
    path('concept', views.add_concept, name='add_concept'),
    path('concepts', views.get_all_concepts, name='get_all_concepts'),
    path('concept/<int:concept_id>/update', views.update_concept, name='update_concept'),
    path('concept/<int:concept_id>/delete', views.delete_concept, name='delete_concept'),
    
    # Иерархия (гиперонимы)
    path('concept/<int:concept_id>/children', views.get_children, name='get_children'),
    path('concept/<int:concept_id>/parent', views.get_parent, name='get_parent'),
    
    # Семантические связи
    path('semantic-edge', views.add_semantic_edge, name='add_semantic_edge'),
    path('semantic-edge/delete', views.delete_semantic_edge, name='delete_semantic_edge'),
    # поиск
    path('search/', views.search_concepts, name='search_concepts'),
    # Загрузка данных
    path('load-concepts/', views.load_concepts, name='load_concepts'),
    path('load-test-data/', views.load_test_data, name='load_test_data'),
]