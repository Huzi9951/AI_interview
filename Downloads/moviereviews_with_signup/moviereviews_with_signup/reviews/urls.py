from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('admin-login/', views.admin_login, name='admin_login'),
    path('admin-panel/', views.admin_panel, name='admin_panel'),
    path('movies/', views.movies_list, name='movies_list'),
    path('movies/<int:pk>/', views.movie_detail, name='movie_detail'),
    path('movies/add/', views.add_movie, name='add_movie'),   # ✅ Add movie route
    path('register/', views.register_view, name='register'),
    path('login/', views.CustomLoginView.as_view(), name='login'),
    path('logout/', views.logout_view, name='logout'),
]
