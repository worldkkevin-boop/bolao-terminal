'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function saveBonusAnswer(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Não autorizado' }

  const questionId = formData.get('questionId') as string
  const groupId = formData.get('groupId') as string
  const answer = formData.get('answer') as string

  if (!questionId || !groupId || !answer) {
    return { error: 'Dados inválidos' }
  }

  // Verificar se a pergunta existe e se o prazo já passou
  const { data: question } = await supabase
    .from('bonus_questions')
    .select('deadline')
    .eq('id', questionId)
    .single()

  if (!question) return { error: 'Pergunta não encontrada' }

  if (new Date(question.deadline) < new Date()) {
    return { error: 'O prazo para responder a esta pergunta já encerrou.' }
  }

  const { error } = await supabase
    .from('bonus_answers')
    .upsert(
      { 
        user_id: user.id, 
        question_id: questionId, 
        answer: answer 
      },
      { onConflict: 'question_id, user_id' }
    )

  if (error) {
    console.error('Falha ao salvar resposta bônus:', error)
    return { error: 'Falha ao salvar resposta' }
  }

  revalidatePath(`/groups/${groupId}/bonus`)
  return { success: true }
}

export async function createBonusQuestion(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Não autorizado' }

  const groupId = formData.get('groupId') as string
  const questionText = formData.get('question') as string
  const questionType = formData.get('questionType') as string
  const optionsString = formData.get('options') as string
  const points = parseInt(formData.get('points') as string)
  const deadline = formData.get('deadline') as string

  if (!groupId || !questionText || !questionType || isNaN(points) || !deadline) {
    return { error: 'Dados incompletos ou inválidos' }
  }

  // Verify user is owner of the group
  const { data: group } = await supabase
    .from('groups')
    .select('owner_id')
    .eq('id', groupId)
    .single()

  if (!group || group.owner_id !== user.id) {
    return { error: 'Apenas o administrador do grupo pode criar perguntas.' }
  }

  let options = null
  if (questionType === 'options' && optionsString) {
    try {
      options = JSON.parse(optionsString)
    } catch (e) {
      return { error: 'Formato de opções inválido.' }
    }
  }

  const { error } = await supabase
    .from('bonus_questions')
    .insert({
      group_id: groupId,
      question: questionText,
      question_type: questionType,
      options,
      points,
      deadline: new Date(deadline).toISOString()
    })

  if (error) {
    console.error('Falha ao criar pergunta bônus:', error)
    return { error: 'Falha ao criar pergunta bônus' }
  }

  revalidatePath(`/groups/${groupId}/bonus/manage`)
  revalidatePath(`/groups/${groupId}/bonus`)
  return { success: true }
}

export async function setBonusCorrectAnswer(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Não autorizado' }

  const questionId = formData.get('questionId') as string
  const groupId = formData.get('groupId') as string
  const correctAnswer = formData.get('correctAnswer') as string

  if (!questionId || !groupId || !correctAnswer) {
    return { error: 'Dados inválidos' }
  }

  // Verify user is owner of the group
  const { data: group } = await supabase
    .from('groups')
    .select('owner_id')
    .eq('id', groupId)
    .single()

  if (!group || group.owner_id !== user.id) {
    return { error: 'Apenas o administrador do grupo pode definir respostas corretas.' }
  }

  const { error } = await supabase
    .from('bonus_questions')
    .update({ correct_answer: correctAnswer })
    .eq('id', questionId)

  if (error) {
    console.error('Falha ao definir resposta correta:', error)
    return { error: 'Falha ao definir resposta correta' }
  }

  revalidatePath(`/groups/${groupId}/bonus/manage`)
  revalidatePath(`/groups/${groupId}/bonus`)
  // Revalidate ranking tab as well because points earned are updated
  revalidatePath(`/groups/${groupId}`)
  return { success: true }
}
